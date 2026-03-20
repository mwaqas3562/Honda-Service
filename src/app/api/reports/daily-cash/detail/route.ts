import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

/**
 * GET /api/reports/daily-cash/detail?date=YYYY-MM-DD
 *
 * Returns actual transaction records for a specific date —
 * Sales, Services, Purchases — used by the Daily Cash drill-down.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const from = new Date(dateParam + "T00:00:00Z");
    const to = new Date(dateParam + "T23:59:59Z");

    // ── Sales for this date ──
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        items: { include: { part: { select: { name: true, partNumber: true } } } },
        labourItems: { include: { labour: { select: { name: true } } } },
        jobCard: { select: { jobCardNumber: true, customerName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── Services for this date ──
    const services = await prisma.service.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        items: { include: { part: { select: { name: true, partNumber: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── Purchases for this date ──
    const purchases = await prisma.purchase.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        items: { include: { part: { select: { name: true, partNumber: true } } } },
        vendor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── Daily cash entry (for expense/salary figures) ──
    const cashEntry = await prisma.dailyCashReport.findFirst({
      where: {
        date: { gte: new Date(dateParam + "T00:00:00Z"), lte: new Date(dateParam + "T23:59:59Z") },
      },
    });

    // ── Actual expense records for this date ──
    const expenseRecords = await prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
    });

    // Format sales
    const salesData = sales.map((s) => ({
      id: s.id,
      ref: s.jobCard?.jobCardNumber || `S-${s.id}`,
      customer: s.customer || s.jobCard?.customerName || "Walk-in",
      paymentType: s.paymentType || "cash",
      status: s.status,
      subtotal: s.subtotal,
      laborCost: s.laborCost,
      discount: s.discount,
      total: s.total,
      items: s.items.map((i) => ({
        name: i.part.name,
        partNumber: i.part.partNumber,
        qty: i.quantity,
        price: i.unitPrice,
        total: i.total,
      })),
      labourItems: s.labourItems.map((l) => ({
        name: l.labour.name,
        qty: l.quantity,
        price: l.unitPrice,
        total: l.total,
      })),
    }));

    // Format services
    const servicesData = services.map((s) => ({
      id: s.id,
      customer: s.customerName,
      bike: `${s.bikeModel}${s.bikeRegNo ? ` (${s.bikeRegNo})` : ""}`,
      serviceType: s.serviceType,
      status: s.status,
      laborCost: s.laborCost,
      total: s.total,
      items: s.items.map((i) => ({
        name: i.part.name,
        partNumber: i.part.partNumber,
        qty: i.quantity,
        price: i.unitPrice,
        total: i.total,
      })),
    }));

    // Format purchases
    const purchasesData = purchases.map((p) => ({
      id: p.id,
      vendor: p.vendor.name,
      status: p.status,
      total: p.total,
      note: p.note,
      items: p.items.map((i) => ({
        name: i.part.name,
        partNumber: i.part.partNumber,
        qty: i.quantity,
        price: i.unitPrice,
        total: i.total,
      })),
    }));

    // Expense breakdown computed from Expense table
    const foodExpenseTotal = expenseRecords.filter((e) => e.type === "food").reduce((s, e) => s + n(e.amount), 0);
    const otherExpenseTotal = expenseRecords.filter((e) => e.type !== "food").reduce((s, e) => s + n(e.amount), 0);
    const expenses = expenseRecords.length > 0
      ? {
          foodExpense: foodExpenseTotal,
          otherExpense: otherExpenseTotal,
          totalExpenses: foodExpenseTotal + otherExpenseTotal,
          notes: cashEntry?.notes ?? null,
        }
      : null;

    // Summary totals
    const salesTotalAmount = sales.reduce((s, v) => s + n(v.total), 0);
    const servicesTotalAmount = services.reduce((s, v) => s + n(v.total), 0);
    const purchasesTotalAmount = purchases.reduce((s, v) => s + n(v.total), 0);

    // Online cash computed from sales with card/online payment + manual advance salary
    const onlineCashTotal = sales
      .filter((s) => s.paymentType === "card" || s.paymentType === "online")
      .reduce((sum, s) => sum + n(s.total), 0);
    const cashInfo = {
      onlineCash: onlineCashTotal,
      purchaseFromSales: purchasesTotalAmount,
      advanceSalary: cashEntry?.advanceSalary ?? 0,
    };

    return NextResponse.json({
      date: dateParam,
      sales: salesData,
      services: servicesData,
      purchases: purchasesData,
      expenses,
      expenseRecords: expenseRecords.map((e) => ({
        id: e.id,
        amount: e.amount,
        type: e.type,
        note: e.note,
        date: e.date,
      })),
      cashInfo,
      summary: {
        salesCount: sales.length,
        salesTotal: salesTotalAmount,
        servicesCount: services.length,
        servicesTotal: servicesTotalAmount,
        purchasesCount: purchases.length,
        purchasesTotal: purchasesTotalAmount,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/daily-cash/detail error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch detail" },
      { status: 500 }
    );
  }
}
