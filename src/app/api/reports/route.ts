import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = new Date();
    const to = toParam ? new Date(toParam + "T23:59:59.999Z") : now;
    const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const diffDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));

    // Parallel data fetching
    const [
      parts,
      salesAll,
      salesPeriod,
      purchasesAll,
      purchasesPeriod,
      servicesAll,
      servicesPeriod,
      stockLogs,
      categories,
    ] = await Promise.all([
      prisma.part.findMany({ select: { id: true, name: true, stock: true, purchasePrice: true, salePrice: true, minStock: true } }),
      prisma.sale.aggregate({ where: { status: "final" }, _sum: { total: true }, _count: true }),
      prisma.sale.findMany({ where: { status: "final", createdAt: { gte: from, lte: to } }, include: { items: { include: { part: { select: { purchasePrice: true } } } } }, orderBy: { createdAt: "desc" } }),
      prisma.purchase.aggregate({ _sum: { total: true }, _count: true }),
      prisma.purchase.findMany({ where: { createdAt: { gte: from, lte: to } }, include: { items: true }, orderBy: { createdAt: "desc" } }),
      prisma.service.aggregate({ _sum: { total: true }, _count: true }),
      prisma.service.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" } }),
      prisma.stockLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "asc" } }),
      prisma.category.findMany({ include: { parts: { select: { stock: true, purchasePrice: true } } } }),
    ]);

    // Inventory summary
    const totalParts = parts.length;
    const totalStockUnits = parts.reduce((s, p) => s + p.stock, 0);
    const totalInventoryValue = parts.reduce((s, p) => s + p.stock * n(p.purchasePrice), 0);
    const lowStockParts = parts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStockParts = parts.filter((p) => p.stock === 0).length;

    // Top parts by value
    const topPartsByValue = parts
      .map((p) => ({ name: p.name, value: p.stock * n(p.purchasePrice), stock: p.stock }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Period sales
    const periodSalesRevenue = salesPeriod.reduce((s, sale) => s + n(sale.total), 0);

    // Period purchases
    const periodPurchasesCost = purchasesPeriod.reduce((s, p) => s + n(p.total), 0);

    // Period services
    const periodServicesRevenue = servicesPeriod.reduce((s, sv) => s + n(sv.total), 0);

    // Daily data for the selected period
    const dailyMap: Record<string, { date: string; sales: number; purchases: number; services: number }> = {};
    for (let i = diffDays - 1; i >= 0; i--) {
      const d = new Date(to.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, sales: 0, purchases: 0, services: 0 };
    }
    for (const sale of salesPeriod) {
      const key = new Date(sale.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].sales += n(sale.total);
    }
    for (const pur of purchasesPeriod) {
      const key = new Date(pur.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].purchases += n(pur.total);
    }
    for (const svc of servicesPeriod) {
      const key = new Date(svc.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].services += n(svc.total);
    }
    const dailyData = Object.values(dailyMap);

    // Stock movement by type (selected period)
    const stockIn = stockLogs.filter((l) => l.type === "purchase").reduce((s, l) => s + l.quantity, 0);
    const stockOut = stockLogs.filter((l) => l.type === "sale" || l.type === "service").reduce((s, l) => s + Math.abs(l.quantity), 0);

    // Category breakdown
    const categoryBreakdown = categories.map((c) => ({
      name: c.name,
      partsCount: c.parts.length,
      totalValue: c.parts.reduce((s, p) => s + p.stock * n(p.purchasePrice), 0),
    })).sort((a, b) => b.totalValue - a.totalValue);

    // Gross profit = (sale price - purchase cost) for each item sold + service labour income
    // This is the real margin on items sold, not affected by bulk stock purchases
    let itemsProfit = 0;
    for (const sale of salesPeriod) {
      for (const item of sale.items) {
        itemsProfit += (n(item.unitPrice) - n(item.part.purchasePrice)) * item.quantity;
      }
      // Labour/discount is already in sale.total but not in items — add labour profit
      itemsProfit += n(sale.laborCost);
    }
    // Service revenue is pure labour income (no parts cost deducted here, parts are in serviceItems)
    const grossProfit = itemsProfit + periodServicesRevenue;

    return NextResponse.json({
      inventory: { totalParts, totalStockUnits, totalInventoryValue, lowStockParts, outOfStockParts, topPartsByValue },
      sales: { totalRevenue: n(salesAll._sum.total ?? 0), periodRevenue: periodSalesRevenue, count: salesAll._count, periodCount: salesPeriod.length },
      purchases: { totalCost: n(purchasesAll._sum.total ?? 0), periodCost: periodPurchasesCost, count: purchasesAll._count, periodCount: purchasesPeriod.length },
      services: { totalRevenue: n(servicesAll._sum.total ?? 0), periodRevenue: periodServicesRevenue, count: servicesAll._count, periodCount: servicesPeriod.length },
      dailyData,
      stockMovement: { stockIn, stockOut },
      categoryBreakdown,
      grossProfit,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), days: diffDays },
    });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json({ error: "Failed to generate reports" }, { status: 500 });
  }
}
