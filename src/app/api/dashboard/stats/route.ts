import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      allParts,
      salesAgg,
      servicesAgg,
      todaySales,
      todayServices,
      todayJobCards,
      todayPurchases,
      recentSales,
      recentServices,
      activeServicesCount,
    ] = await Promise.all([
      prisma.part.findMany(),
      prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { status: "final" } }),
      prisma.service.aggregate({ _sum: { total: true }, _count: true }),
      prisma.sale.findMany({ where: { createdAt: { gte: todayStart } }, include: { jobCard: { select: { jobCardNumber: true } } } }),
      prisma.service.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.jobCard.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.purchase.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.sale.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { part: { select: { name: true } } } },
          jobCard: { select: { jobCardNumber: true, customerName: true, bikeModel: true, vehicleNumber: true } },
        },
      }),
      prisma.service.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
      prisma.service.count({ where: { status: { in: ["pending", "in_progress"] } } }),
    ]);

    const totalParts = allParts.length;
    const totalStock = allParts.reduce((sum, p) => sum + p.stock, 0);
    const lowStockCount = allParts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStockCount = allParts.filter((p) => p.stock === 0).length;
    const totalInventoryValue = Math.round(allParts.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0) * 100) / 100;

    const totalSalesRevenue = Math.round((salesAgg._sum.total || 0) * 100) / 100;
    const totalSalesCount = salesAgg._count;
    const totalServicesRevenue = Math.round((servicesAgg._sum.total || 0) * 100) / 100;

    // Today aggregations
    const todayFinalSales = todaySales.filter((s) => s.status === "final");
    const todayDraftSales = todaySales.filter((s) => s.status === "draft");

    return NextResponse.json({
      totalParts,
      totalStock,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue,
      totalSalesRevenue,
      totalSalesCount,
      totalServicesRevenue,
      activeServicesCount,
      // Today's metrics
      todayJobCardsCount: todayJobCards.length,
      todayPurchasesCount: todayPurchases.length,
      todayPurchasesAmount: Math.round(todayPurchases.reduce((s, p) => s + p.total, 0) * 100) / 100,
      todaySalesCount: todayFinalSales.length,
      todaySalesRevenue: Math.round(todayFinalSales.reduce((s, sale) => s + sale.total, 0) * 100) / 100,
      todayDraftsCount: todayDraftSales.length,
      todayServicesCount: todayServices.length,
      todayServicesRevenue: Math.round(todayServices.reduce((s, svc) => s + svc.total, 0) * 100) / 100,
      // Recent sales with job card info
      recentSales: recentSales.map((s) => ({
        id: s.id,
        invoiceNumber: `S${String(s.id).padStart(3, "0")}`,
        customer: s.customer || s.jobCard?.customerName || "Walk-in",
        jobCardNumber: s.jobCard?.jobCardNumber || null,
        bikeModel: s.jobCard?.bikeModel || null,
        vehicleNumber: s.jobCard?.vehicleNumber || null,
        total: s.total,
        status: s.status,
        date: s.createdAt,
        itemCount: s.items.length,
        items: s.items.map((i) => i.part.name).join(", "),
      })),
      recentServices: recentServices.map((s) => ({
        id: s.id,
        customer: s.customerName,
        bike: s.bikeModel,
        service: s.serviceType,
        status: s.status,
        total: s.total,
        date: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
