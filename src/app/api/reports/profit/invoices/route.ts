import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { round2, n } from "@/lib/utils";

/**
 * GET /api/reports/profit/invoices?customer=NAME&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns invoice-level profit breakdown for a specific customer:
 * - Each invoice with sale amount, purchase cost, profit
 * - Each invoice's items with item-level profit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customer = searchParams.get("customer");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!customer) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const now = new Date();
    const from = fromParam
      ? new Date(fromParam + "T00:00:00Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const to = toParam
      ? new Date(toParam + "T23:59:59Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));

    // Fetch all sales for this customer with items + part details + labour items
    const sales = await prisma.sale.findMany({
      where: {
        customer: customer === "Walk-in Customer" ? null : customer,
        createdAt: { gte: from, lte: to },
      },
      include: {
        items: {
          include: {
            part: {
              select: {
                name: true,
                partNumber: true,
                purchasePrice: true,
              },
            },
          },
        },
        labourItems: {
          include: {
            labour: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // If customer is "Walk-in Customer", also include sales where customer is empty string
    let allSales = sales;
    if (customer === "Walk-in Customer") {
      const emptySales = await prisma.sale.findMany({
        where: {
          customer: "",
          createdAt: { gte: from, lte: to },
        },
        include: {
          items: {
            include: {
              part: {
                select: {
                  name: true,
                  partNumber: true,
                  purchasePrice: true,
                },
              },
            },
          },
          labourItems: {
            include: {
              labour: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      allSales = [...sales, ...emptySales].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Build invoice-level data — no expense allocation per invoice
    const invoices = allSales.map((sale) => {
      const purchaseCost = sale.items.reduce(
        (sum, item) => sum + item.quantity * n(item.part.purchasePrice),
        0
      );
      const labourTotal = sale.labourItems.reduce((sum, li) => sum + n(li.total), 0);
      const profit = round2(n(sale.total) - purchaseCost);

      const items = sale.items.map((item) => ({
        name: item.part.name,
        partNumber: item.part.partNumber,
        quantity: item.quantity,
        salePrice: round2(n(item.unitPrice)),
        salePriceTotal: round2(n(item.total)),
        purchaseCost: round2(n(item.part.purchasePrice)),
        purchaseCostTotal: round2(item.quantity * n(item.part.purchasePrice)),
        profit: round2(n(item.total) - item.quantity * n(item.part.purchasePrice)),
      }));

      const labourItems = sale.labourItems.map((li) => ({
        name: li.labour.name,
        quantity: li.quantity,
        unitPrice: round2(n(li.unitPrice)),
        total: round2(n(li.total)),
      }));

      return {
        id: sale.id,
        date: sale.createdAt.toISOString(),
        customer: sale.customer || "Walk-in Customer",
        saleAmount: round2(n(sale.total)),
        purchaseCost: round2(purchaseCost),
        labourTotal: round2(labourTotal),
        profit,
        discount: round2(n(sale.discount)),
        paymentType: sale.paymentType,
        status: sale.status,
        itemCount: sale.items.length,
        items,
        labourItems,
      };
    });

    // Summary for this customer
    const summary = {
      customerName: customer,
      invoiceCount: invoices.length,
      totalSales: round2(invoices.reduce((s, inv) => s + inv.saleAmount, 0)),
      totalPurchaseCost: round2(invoices.reduce((s, inv) => s + inv.purchaseCost, 0)),
      totalLabour: round2(invoices.reduce((s, inv) => s + inv.labourTotal, 0)),
      totalProfit: round2(invoices.reduce((s, inv) => s + inv.profit, 0)),
    };

    return NextResponse.json({ invoices, summary });
  } catch (error) {
    console.error("GET /api/reports/profit/invoices error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invoice profit" },
      { status: 500 }
    );
  }
}
