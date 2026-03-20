import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { round2, n } from "@/lib/utils";

/**
 * GET /api/reports/profit/customers?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Business-optimized customer profit report.
 * Customer profit = Sales − Purchase Cost (no expense distribution).
 * Expenses are shown only in the business-level summary:
 *   Net Profit = Parts Profit + Labour Income − Total Expenses
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam
      ? new Date(fromParam + "T00:00:00Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const to = toParam
      ? new Date(toParam + "T23:59:59Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));

    // Parallel: fetch sales + expenses
    const [sales, expenseAgg] = await Promise.all([
      prisma.sale.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          customer: true,
          total: true,
          items: {
            select: {
              quantity: true,
              total: true,
              part: { select: { purchasePrice: true } },
            },
          },
          labourItems: {
            select: { total: true },
          },
        },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ]);

    const totalExpenses = n(expenseAgg._sum.amount);

    // Aggregate per customer
    const customerMap = new Map<
      string,
      {
        totalSales: number;
        totalPurchaseCost: number;
        labourIncome: number;
        invoiceCount: number;
      }
    >();

    for (const sale of sales) {
      const name = sale.customer || "Walk-in Customer";
      let cust = customerMap.get(name);
      if (!cust) {
        cust = { totalSales: 0, totalPurchaseCost: 0, labourIncome: 0, invoiceCount: 0 };
        customerMap.set(name, cust);
      }

      cust.totalSales += n(sale.total);
      cust.invoiceCount += 1;

      for (const item of sale.items) {
        cust.totalPurchaseCost += item.quantity * n(item.part.purchasePrice);
      }

      for (const li of sale.labourItems) {
        cust.labourIncome += n(li.total);
      }
    }

    // Build result — NO expense allocation per customer
    const customers = Array.from(customerMap.entries()).map(([customerName, data]) => {
      const profit = round2(data.totalSales - data.totalPurchaseCost);
      const profitPct = data.totalSales > 0 ? round2((profit / data.totalSales) * 100) : 0;
      return {
        customerName,
        totalSales: round2(data.totalSales),
        totalPurchaseCost: round2(data.totalPurchaseCost),
        labourIncome: round2(data.labourIncome),
        profit,
        profitPct,
        invoiceCount: data.invoiceCount,
      };
    });

    // Default sort: profit descending
    customers.sort((a, b) => b.profit - a.profit);

    // Business-level summary
    const totalSales = round2(customers.reduce((s, c) => s + c.totalSales, 0));
    const totalPurchaseCost = round2(customers.reduce((s, c) => s + c.totalPurchaseCost, 0));
    const totalLabourIncome = round2(customers.reduce((s, c) => s + c.labourIncome, 0));
    const partsProfit = round2(totalSales - totalPurchaseCost);
    // Net Profit = Parts Profit + Labour − Expenses
    const netProfit = round2(partsProfit + totalLabourIncome - totalExpenses);

    const summary = {
      totalSales,
      totalPurchaseCost,
      partsProfit,
      totalLabourIncome,
      totalExpenses: round2(totalExpenses),
      netProfit,
      customerCount: customers.length,
    };

    return NextResponse.json({ customers, summary });
  } catch (error) {
    console.error("GET /api/reports/profit/customers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch customer profit" },
      { status: 500 }
    );
  }
}
