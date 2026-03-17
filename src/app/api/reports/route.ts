import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Parallel data fetching
    const [
      parts,
      salesAll,
      purchasesAll,
      servicesAll,
      stockLogs,
      categories,
    ] = await Promise.all([
      prisma.part.findMany({ select: { id: true, name: true, stock: true, purchasePrice: true, salePrice: true, minStock: true, category: true } }),
      prisma.sale.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }),
      prisma.purchase.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }),
      prisma.service.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.stockLog.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, orderBy: { createdAt: "asc" } }),
      prisma.category.findMany({ include: { parts: { select: { stock: true, purchasePrice: true } } } }),
    ]);

    // Inventory summary
    const totalParts = parts.length;
    const totalStockUnits = parts.reduce((s, p) => s + p.stock, 0);
    const totalInventoryValue = parts.reduce((s, p) => s + p.stock * p.purchasePrice, 0);
    const lowStockParts = parts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStockParts = parts.filter((p) => p.stock === 0).length;

    // Top parts by value
    const topPartsByValue = parts
      .map((p) => ({ name: p.name, value: p.stock * p.purchasePrice, stock: p.stock }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Sales summary
    const totalSalesRevenue = salesAll.reduce((s, sale) => s + sale.total, 0);
    const recentSales = salesAll.filter((s) => new Date(s.createdAt) >= thirtyDaysAgo);
    const recentSalesRevenue = recentSales.reduce((s, sale) => s + sale.total, 0);

    // Purchases summary
    const totalPurchasesCost = purchasesAll.reduce((s, p) => s + p.total, 0);
    const recentPurchases = purchasesAll.filter((p) => new Date(p.createdAt) >= thirtyDaysAgo);
    const recentPurchasesCost = recentPurchases.reduce((s, p) => s + p.total, 0);

    // Services summary
    const totalServicesRevenue = servicesAll.reduce((s, sv) => s + sv.total, 0);
    const recentServices = servicesAll.filter((sv) => new Date(sv.createdAt) >= thirtyDaysAgo);
    const recentServicesRevenue = recentServices.reduce((s, sv) => s + sv.total, 0);

    // Daily sales/purchases/services for last 30 days (for charts)
    const dailyMap: Record<string, { date: string; sales: number; purchases: number; services: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, sales: 0, purchases: 0, services: 0 };
    }
    for (const sale of recentSales) {
      const key = new Date(sale.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].sales += sale.total;
    }
    for (const pur of recentPurchases) {
      const key = new Date(pur.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].purchases += pur.total;
    }
    for (const svc of recentServices) {
      const key = new Date(svc.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].services += svc.total;
    }
    const dailyData = Object.values(dailyMap);

    // Stock movement by type (last 30 days)
    const stockIn = stockLogs.filter((l) => l.type === "purchase").reduce((s, l) => s + l.quantity, 0);
    const stockOut = stockLogs.filter((l) => l.type === "sale" || l.type === "service").reduce((s, l) => s + Math.abs(l.quantity), 0);

    // Category breakdown
    const categoryBreakdown = categories.map((c) => ({
      name: c.name,
      partsCount: c.parts.length,
      totalValue: c.parts.reduce((s, p) => s + p.stock * p.purchasePrice, 0),
    })).sort((a, b) => b.totalValue - a.totalValue);

    // Profit estimate (recent)
    const grossProfit = recentSalesRevenue + recentServicesRevenue - recentPurchasesCost;

    return NextResponse.json({
      inventory: { totalParts, totalStockUnits, totalInventoryValue, lowStockParts, outOfStockParts, topPartsByValue },
      sales: { totalRevenue: totalSalesRevenue, recentRevenue: recentSalesRevenue, count: salesAll.length, recentCount: recentSales.length },
      purchases: { totalCost: totalPurchasesCost, recentCost: recentPurchasesCost, count: purchasesAll.length, recentCount: recentPurchases.length },
      services: { totalRevenue: totalServicesRevenue, recentRevenue: recentServicesRevenue, count: servicesAll.length, recentCount: recentServices.length },
      dailyData,
      stockMovement: { stockIn, stockOut },
      categoryBreakdown,
      grossProfit,
    });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json({ error: "Failed to generate reports" }, { status: 500 });
  }
}
