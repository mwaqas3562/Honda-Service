import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { round2, n } from "@/lib/utils";

/**
 * GET /api/reports/profit?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Accounting-style profit report: every invoice with
 * Labour, Parts, Discount, Bill Amount, Cost, Profit.
 * Plus grand totals, expenses, and net profit.
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

    // Parallel: fetch all sales with items + labour, job card info, and expenses
    const [sales, expenseAgg] = await Promise.all([
      prisma.sale.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          customer: true,
          total: true,
          discount: true,
          subtotal: true,
          laborCost: true,
          jobCardId: true,
          jobCard: {
            select: { jobCardNumber: true },
          },
          createdAt: true,
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
        orderBy: { createdAt: "asc" },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ]);

    const totalExpenses = n(expenseAgg._sum.amount);

    // Build invoice rows
    const invoices = sales.map((sale) => {
      const labour = sale.labourItems.reduce((sum, li) => sum + n(li.total), 0);
      const partsTotal = sale.items.reduce((sum, item) => sum + n(item.total), 0);
      const cost = sale.items.reduce(
        (sum, item) => sum + item.quantity * n(item.part.purchasePrice),
        0
      );
      const billAmount = n(sale.total);
      const discount = n(sale.discount);
      const profit = round2(billAmount - cost);

      return {
        id: sale.id,
        date: sale.createdAt.toISOString(),
        jobNo: sale.jobCard?.jobCardNumber || null,
        customer: sale.customer || "Walk-in Customer",
        labour: round2(labour),
        parts: round2(partsTotal),
        discount: round2(discount),
        billAmount: round2(billAmount),
        cost: round2(cost),
        profit,
      };
    });

    // Grand totals (pre-aggregated — no frontend recalc needed)
    const totals = {
      labour: round2(invoices.reduce((s, i) => s + i.labour, 0)),
      parts: round2(invoices.reduce((s, i) => s + i.parts, 0)),
      discount: round2(invoices.reduce((s, i) => s + i.discount, 0)),
      billAmount: round2(invoices.reduce((s, i) => s + i.billAmount, 0)),
      cost: round2(invoices.reduce((s, i) => s + i.cost, 0)),
      profit: round2(invoices.reduce((s, i) => s + i.profit, 0)),
      expenses: round2(totalExpenses),
      netProfit: round2(invoices.reduce((s, i) => s + i.profit, 0) - totalExpenses),
      invoiceCount: invoices.length,
    };

    // Profit percentage
    totals.netProfit = round2(totals.profit - totals.expenses);
    const profitPct = totals.billAmount > 0
      ? round2((totals.profit / totals.billAmount) * 100)
      : 0;

    return NextResponse.json({
      invoices,
      totals: { ...totals, profitPct },
    });
  } catch (error) {
    console.error("GET /api/reports/profit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch profit report" },
      { status: 500 }
    );
  }
}
