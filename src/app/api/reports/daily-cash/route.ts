import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { round2, n } from "@/lib/utils";

function toDateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * GET /api/reports/daily-cash?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns daily cash report computed dynamically from real transaction data:
 * - totalSales: SUM(Sale.total) + SUM(Service.total)
 * - foodExpense: SUM(Expense.amount WHERE type='food')
 * - otherExpense: SUM(Expense.amount WHERE type IN ('utility','misc'))
 * - purchaseFromSales: SUM(Purchase.total)
 * - onlineCash: SUM(Sale.total WHERE paymentType IN ('card','online'))
 * - advanceSalary / notes: from DailyCashReport manual entries
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

    // Fetch all data in parallel
    const [sales, services, purchases, expenses, manualEntries] = await Promise.all([
      prisma.sale.findMany({
        where: { status: "final", createdAt: { gte: from, lte: to } },
        select: { total: true, paymentType: true, createdAt: true },
      }),
      prisma.service.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { total: true, createdAt: true },
      }),
      prisma.purchase.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { total: true, createdAt: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: from, lte: to } },
        select: { amount: true, type: true, date: true },
      }),
      prisma.dailyCashReport.findMany({
        where: { date: { gte: from, lte: to } },
      }),
    ]);

    // Build a map of date → manual entries (advanceSalary, notes)
    const manualMap = new Map<string, { id: number; advanceSalary: number; notes: string | null }>();
    for (const m of manualEntries) {
      manualMap.set(toDateOnly(m.date), {
        id: m.id,
        advanceSalary: n(m.advanceSalary),
        notes: m.notes,
      });
    }

    // Aggregate by date
    interface DayBucket {
      totalSales: number;
      onlineCash: number;
      foodExpense: number;
      otherExpense: number;
      purchaseFromSales: number;
    }
    const dayMap = new Map<string, DayBucket>();

    const getBucket = (dateKey: string): DayBucket => {
      let b = dayMap.get(dateKey);
      if (!b) {
        b = { totalSales: 0, onlineCash: 0, foodExpense: 0, otherExpense: 0, purchaseFromSales: 0 };
        dayMap.set(dateKey, b);
      }
      return b;
    }

    for (const s of sales) {
      const key = toDateOnly(s.createdAt);
      const b = getBucket(key);
      b.totalSales += n(s.total);
      if (s.paymentType === "card" || s.paymentType === "online") {
        b.onlineCash += n(s.total);
      }
    }

    for (const s of services) {
      const key = toDateOnly(s.createdAt);
      getBucket(key).totalSales += n(s.total);
    }

    for (const p of purchases) {
      const key = toDateOnly(p.createdAt);
      getBucket(key).purchaseFromSales += n(p.total);
    }

    for (const e of expenses) {
      const key = toDateOnly(e.date);
      const b = getBucket(key);
      if (e.type === "food") {
        b.foodExpense += n(e.amount);
      } else {
        b.otherExpense += n(e.amount);
      }
    }

    // Also include dates that only have manual entries
    manualMap.forEach((_, dateKey) => {
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { totalSales: 0, onlineCash: 0, foodExpense: 0, otherExpense: 0, purchaseFromSales: 0 });
      }
    });

    // Build enriched entries sorted by date desc
    const allDates = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));

    const enriched = allDates.map((dateKey) => {
      const b = dayMap.get(dateKey)!;
      const manual = manualMap.get(dateKey);

      const totalSales = round2(b.totalSales);
      const foodExpense = round2(b.foodExpense);
      const otherExpense = round2(b.otherExpense);
      const totalExpenses = round2(foodExpense + otherExpense);
      const purchaseFromSales = round2(b.purchaseFromSales);
      const onlineCash = round2(b.onlineCash);
      const advanceSalary = manual?.advanceSalary ?? 0;
      const cashInHand = round2(totalSales - totalExpenses - purchaseFromSales - onlineCash);
      const takeHomeCash = round2(cashInHand - advanceSalary);

      return {
        id: manual?.id ?? 0,
        date: dateKey,
        totalSales,
        foodExpense,
        otherExpense,
        totalExpenses,
        purchaseFromSales,
        onlineCash,
        cashInHand,
        advanceSalary,
        takeHomeCash,
        notes: manual?.notes ?? null,
      };
    });

    // Summary totals
    const totals = enriched.reduce(
      (acc, e) => ({
        totalSales: round2(acc.totalSales + e.totalSales),
        foodExpense: round2(acc.foodExpense + e.foodExpense),
        otherExpense: round2(acc.otherExpense + e.otherExpense),
        totalExpenses: round2(acc.totalExpenses + e.totalExpenses),
        purchaseFromSales: round2(acc.purchaseFromSales + e.purchaseFromSales),
        onlineCash: round2(acc.onlineCash + e.onlineCash),
        cashInHand: round2(acc.cashInHand + e.cashInHand),
        advanceSalary: round2(acc.advanceSalary + e.advanceSalary),
        takeHomeCash: round2(acc.takeHomeCash + e.takeHomeCash),
      }),
      {
        totalSales: 0,
        foodExpense: 0,
        otherExpense: 0,
        totalExpenses: 0,
        purchaseFromSales: 0,
        onlineCash: 0,
        cashInHand: 0,
        advanceSalary: 0,
        takeHomeCash: 0,
      }
    );

    return NextResponse.json({ entries: enriched, totals, count: enriched.length });
  } catch (error) {
    console.error("GET /api/reports/daily-cash error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch daily cash report" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/daily-cash
 *
 * Save manual-only fields (advanceSalary, notes) for a date.
 * All other values (sales, expenses, purchases, onlineCash)
 * are computed dynamically from transaction tables.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, advanceSalary, notes } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const dateObj = new Date(date + "T00:00:00Z");
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const data = {
      advanceSalary: Number(advanceSalary) || 0,
      notes: notes?.trim() || null,
      // Store zeros for computed fields — they're only here for schema compatibility
      totalSales: 0,
      foodExpense: 0,
      otherExpense: 0,
      purchaseFromSales: 0,
      onlineCash: 0,
    };

    const entry = await prisma.dailyCashReport.upsert({
      where: { date: dateObj },
      update: { advanceSalary: data.advanceSalary, notes: data.notes },
      create: { date: dateObj, ...data },
    });

    // Compute live totals for the response
    const dayStart = new Date(date + "T00:00:00Z");
    const dayEnd = new Date(date + "T23:59:59Z");

    const [salesAgg, servicesAgg, purchasesAgg, expensesData, onlineSales] = await Promise.all([
      prisma.sale.aggregate({ where: { status: "final", createdAt: { gte: dayStart, lte: dayEnd } }, _sum: { total: true } }),
      prisma.service.aggregate({ where: { createdAt: { gte: dayStart, lte: dayEnd } }, _sum: { total: true } }),
      prisma.purchase.aggregate({ where: { createdAt: { gte: dayStart, lte: dayEnd } }, _sum: { total: true } }),
      prisma.expense.findMany({ where: { date: { gte: dayStart, lte: dayEnd } }, select: { amount: true, type: true } }),
      prisma.sale.aggregate({
        where: { status: "final", createdAt: { gte: dayStart, lte: dayEnd }, paymentType: { in: ["card", "online"] } },
        _sum: { total: true },
      }),
    ]);

    const totalSales = round2(n(salesAgg._sum.total) + n(servicesAgg._sum.total));
    const foodExpense = round2(expensesData.filter((e) => e.type === "food").reduce((s, e) => s + n(e.amount), 0));
    const otherExpense = round2(expensesData.filter((e) => e.type !== "food").reduce((s, e) => s + n(e.amount), 0));
    const totalExpenses = round2(foodExpense + otherExpense);
    const purchaseFromSales = round2(n(purchasesAgg._sum.total));
    const onlineCash = round2(n(onlineSales._sum.total));
    const cashInHand = round2(totalSales - totalExpenses - purchaseFromSales - onlineCash);
    const takeHomeCash = round2(cashInHand - n(entry.advanceSalary));

    return NextResponse.json({
      id: entry.id,
      date: toDateOnly(entry.date),
      totalSales,
      foodExpense,
      otherExpense,
      totalExpenses,
      purchaseFromSales,
      onlineCash,
      cashInHand,
      advanceSalary: entry.advanceSalary,
      takeHomeCash,
      notes: entry.notes,
    });
  } catch (error) {
    console.error("POST /api/reports/daily-cash error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save daily cash entry" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/daily-cash?id=123
 *
 * Delete a daily cash entry by ID.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.dailyCashReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reports/daily-cash error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete entry" },
      { status: 500 }
    );
  }
}
