import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

/**
 * GET /api/reports/inventory?search=&category=&sort=&stockFilter=
 *
 * Inventory report: per-part stock value, movement summary, stock ledger drill-down.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category");
    const stockFilter = searchParams.get("stockFilter") || "all"; // all|low|out|ok
    const sortBy = searchParams.get("sort") || "value"; // value|stock|name|movement
    const partId = searchParams.get("partId"); // If provided → return stock ledger for this part

    // ── Single part stock ledger ──
    if (partId) {
      const part = await prisma.part.findUnique({
        where: { id: Number(partId) },
        select: { id: true, name: true, partNumber: true, category: { select: { name: true } }, stock: true, purchasePrice: true, salePrice: true, minStock: true },
      });
      if (!part) {
        return NextResponse.json({ error: "Part not found" }, { status: 404 });
      }

      const logs = await prisma.stockLog.findMany({
        where: { partId: Number(partId) },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const ledger = logs.map((l) => ({
        id: l.id,
        date: l.createdAt.toISOString(),
        type: l.type,
        quantity: l.quantity,
        prevStock: l.prevStock,
        newStock: l.newStock,
        purchasePrice: l.purchasePrice,
        prevPrice: l.prevPrice,
        note: l.note,
      }));

      return NextResponse.json({ part, ledger });
    }

    // ── Inventory overview ──
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { partNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) {
      where.category = { name: category };
    }

    const parts = await prisma.part.findMany({
      where,
      select: {
        id: true,
        name: true,
        partNumber: true,
        category: true,
        stock: true,
        purchasePrice: true,
        salePrice: true,
        minStock: true,
        usageCount: true,
        _count: { select: { stockLogs: true } },
      },
    });

    // Get recent stock movement counts per part (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await prisma.stockLog.groupBy({
      by: ["partId", "type"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { quantity: true },
    });

    const movementMap = new Map<number, { stockIn: number; stockOut: number }>();
    for (const log of recentLogs) {
      const entry = movementMap.get(log.partId) || { stockIn: 0, stockOut: 0 };
      if (log.type === "purchase") {
        entry.stockIn += log._sum.quantity || 0;
      } else if (log.type === "sale" || log.type === "service") {
        entry.stockOut += Math.abs(log._sum.quantity || 0);
      }
      movementMap.set(log.partId, entry);
    }

    let items = parts.map((p) => {
      const mv = movementMap.get(p.id) || { stockIn: 0, stockOut: 0 };
      const catName = p.category?.name || "Uncategorized";
      return {
        id: p.id,
        name: p.name,
        partNumber: p.partNumber,
        category: catName,
        stock: p.stock,
        purchasePrice: n(p.purchasePrice),
        salePrice: n(p.salePrice),
        minStock: p.minStock,
        stockValue: Math.round(p.stock * n(p.purchasePrice) * 100) / 100,
        saleValue: Math.round(p.stock * n(p.salePrice) * 100) / 100,
        potentialProfit: Math.round(p.stock * (n(p.salePrice) - n(p.purchasePrice)) * 100) / 100,
        usageCount: p.usageCount,
        logCount: p._count.stockLogs,
        stockIn30d: mv.stockIn,
        stockOut30d: mv.stockOut,
        status: p.stock === 0 ? "out" : p.stock <= p.minStock ? "low" : "ok",
      };
    });

    // Stock filter
    if (stockFilter === "low") items = items.filter((i) => i.status === "low");
    else if (stockFilter === "out") items = items.filter((i) => i.status === "out");
    else if (stockFilter === "ok") items = items.filter((i) => i.status === "ok");

    // Sort
    if (sortBy === "value") items.sort((a, b) => b.stockValue - a.stockValue);
    else if (sortBy === "stock") items.sort((a, b) => b.stock - a.stock);
    else if (sortBy === "name") items.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "movement") items.sort((a, b) => (b.stockIn30d + b.stockOut30d) - (a.stockIn30d + a.stockOut30d));

    // Summary
    const totalValue = items.reduce((s, i) => s + i.stockValue, 0);
    const totalSaleValue = items.reduce((s, i) => s + i.saleValue, 0);
    const totalPotentialProfit = items.reduce((s, i) => s + i.potentialProfit, 0);
    const totalParts = items.length;
    const lowStock = items.filter((i) => i.status === "low").length;
    const outOfStock = items.filter((i) => i.status === "out").length;

    // Categories
    const catMap = new Map<string, { count: number; value: number }>();
    for (const i of items) {
      const e = catMap.get(i.category) || { count: 0, value: 0 };
      e.count++;
      e.value += i.stockValue;
      catMap.set(i.category, e);
    }
    const categories = Array.from(catMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      items,
      summary: {
        totalParts,
        totalValue: Math.round(totalValue),
        totalSaleValue: Math.round(totalSaleValue),
        totalPotentialProfit: Math.round(totalPotentialProfit),
        lowStock,
        outOfStock,
      },
      categories,
    });
  } catch (error) {
    console.error("GET /api/reports/inventory error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch inventory report" },
      { status: 500 }
    );
  }
}
