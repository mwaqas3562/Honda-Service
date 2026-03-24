import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      allParts,
      salesAgg,
      servicesAgg,
      qsAgg,
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
      prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { status: "final", saleType: "quick_service" } }),
      prisma.sale.findMany({ where: { createdAt: { gte: todayStart } }, include: { jobCard: { select: { jobCardNumber: true } } } }),
      prisma.service.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.jobCard.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.purchase.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.sale.findMany({
        where: { saleType: "sale" },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { part: { select: { name: true } } } },
          jobCard: { select: { jobCardNumber: true, customerName: true, bikeModel: true, vehicleNumber: true } },
        },
      }),
      prisma.sale.findMany({
        where: { saleType: "quick_service", status: "final" },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, customer: true, bikeNumber: true, total: true, status: true, createdAt: true, labourItems: { take: 1, select: { labour: { select: { name: true } } } } },
      }),
      prisma.service.count({ where: { status: { in: ["pending", "in_progress"] } } }),
    ]);

    const totalParts = allParts.length;
    const totalStock = allParts.reduce((sum, p) => sum + p.stock, 0);
    const lowStockCount = allParts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStockCount = allParts.filter((p) => p.stock === 0).length;
    const totalInventoryValue = Math.round(allParts.reduce((sum, p) => sum + n(p.purchasePrice) * p.stock, 0) * 100) / 100;

    const totalSalesRevenue = Math.round(n(salesAgg._sum.total) * 100) / 100;
    const totalSalesCount = salesAgg._count;
    const totalServicesRevenue = Math.round((n(servicesAgg._sum.total) + n(qsAgg._sum.total)) * 100) / 100;
    const totalServicesCount = servicesAgg._count + qsAgg._count;

    // Today aggregations
    const todayFinalSales = todaySales.filter((s) => s.status === "final" && s.saleType !== "quick_service");
    const todayDraftSales = todaySales.filter((s) => s.status === "draft");
    const todayQS = todaySales.filter((s) => s.saleType === "quick_service" && s.status === "final");
    const todayQSDrafts = todaySales.filter((s) => s.saleType === "quick_service" && s.status === "draft");

    return NextResponse.json({
      totalParts,
      totalStock,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue,
      totalSalesRevenue,
      totalSalesCount,
      totalServicesRevenue,
      totalServicesCount,
      activeServicesCount,
      // Today's metrics
      todayJobCardsCount: todayJobCards.length,
      todayPurchasesCount: todayPurchases.length,
      todayPurchasesAmount: Math.round(todayPurchases.reduce((s, p) => s + n(p.total), 0) * 100) / 100,
      todaySalesCount: todayFinalSales.length,
      todaySalesRevenue: Math.round(todayFinalSales.reduce((s, sale) => s + n(sale.total), 0) * 100) / 100,
      todayDraftsCount: todayDraftSales.length,
      todayServicesCount: todayServices.length + todayQS.length,
      todayServicesRevenue: Math.round((todayServices.reduce((s, svc) => s + n(svc.total), 0) + todayQS.reduce((s, sale) => s + n(sale.total), 0)) * 100) / 100,
      todayServicesDraftsCount: todayQSDrafts.length,
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
        customer: s.customer || "Walk-in",
        bike: s.bikeNumber || "—",
        service: s.labourItems[0]?.labour?.name || "Quick Service",
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
