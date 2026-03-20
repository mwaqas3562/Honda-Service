import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

export interface StockAlert {
  id: number;
  name: string;
  partNumber: string;
  category: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  salePrice: number;
  avgDailySales: number;
  estimatedDaysLeft: number | null; // null = no recent sales (infinite)
  severity: "red" | "orange" | "green" | "safe";
  suggestedReorderQty: number;
  lastVendor: string | null;
  lastPurchasePrice: number | null;
}

// GET /api/parts/stock-alerts?days=14&threshold=7
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lookbackDays = Math.min(Math.max(parseInt(searchParams.get("days") || "14") || 14, 1), 90);
    const threshold = Math.min(Math.max(parseInt(searchParams.get("threshold") || "7") || 7, 1), 90);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - lookbackDays);

    // Get all parts
    const allParts = await prisma.part.findMany({
      include: { category: true },
      orderBy: { stock: "asc" },
    });

    // Aggregate sale_items quantities per part since lookback date (only finalized sales)
    const saleAgg: { part_id: number; total_qty: bigint }[] = await prisma.$queryRaw`
      SELECT si.part_id, SUM(si.quantity)::bigint AS total_qty
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'final' AND s.date >= ${sinceDate}
       GROUP BY si.part_id`;

    // Aggregate service_items quantities per part since lookback date
    const serviceAgg: { part_id: number; total_qty: bigint }[] = await prisma.$queryRaw`
      SELECT si.part_id, SUM(si.quantity)::bigint AS total_qty
       FROM service_items si
       JOIN services s ON s.id = si.service_id
       WHERE s.created_at >= ${sinceDate}
       GROUP BY si.part_id`;

    // Build a map of partId -> total quantity sold/used
    const usageMap = new Map<number, number>();
    for (const row of saleAgg) {
      usageMap.set(row.part_id, (usageMap.get(row.part_id) || 0) + Number(row.total_qty));
    }
    for (const row of serviceAgg) {
      usageMap.set(row.part_id, (usageMap.get(row.part_id) || 0) + Number(row.total_qty));
    }

    // Get last vendor info for parts that are low stock
    const lastVendorMap = new Map<number, { vendor: string; price: number }>();
    const lowIds = allParts.filter((p) => p.stock <= p.minStock || usageMap.has(p.id)).map((p) => p.id);
    if (lowIds.length > 0) {
      const vendorRows: { part_id: number; vendor_name: string; unit_price: number }[] = await prisma.$queryRaw`
        SELECT DISTINCT ON (pi.part_id)
           pi.part_id, v.name AS vendor_name, pi.unit_price
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         JOIN vendors v ON v.id = p.vendor_id
         WHERE pi.part_id = ANY(${lowIds})
         ORDER BY pi.part_id, p.created_at DESC`;
      for (const row of vendorRows) {
        lastVendorMap.set(row.part_id, { vendor: row.vendor_name, price: row.unit_price });
      }
    }

    const SAFETY_BUFFER_DAYS = 7;

    const alerts: StockAlert[] = allParts.map((part) => {
      const totalUsed = usageMap.get(part.id) || 0;
      const avgDailySales = totalUsed / lookbackDays;

      let estimatedDaysLeft: number | null = null;
      if (avgDailySales > 0) {
        estimatedDaysLeft = Math.floor(part.stock / avgDailySales);
      }

      let severity: StockAlert["severity"] = "safe";
      if (estimatedDaysLeft !== null) {
        if (estimatedDaysLeft < 3) severity = "red";
        else if (estimatedDaysLeft <= threshold) severity = "orange";
        else severity = "green";
      } else if (part.stock <= part.minStock) {
        // No recent sales but stock is below minimum
        severity = part.stock === 0 ? "red" : "orange";
        estimatedDaysLeft = part.stock === 0 ? 0 : null;
      }

      // Suggested reorder: enough to cover (threshold + safety buffer) days of avg sales, minus current stock
      let suggestedReorderQty = 0;
      if (avgDailySales > 0) {
        const targetStock = Math.ceil(avgDailySales * (threshold + SAFETY_BUFFER_DAYS));
        suggestedReorderQty = Math.max(targetStock - part.stock, 0);
      } else if (part.stock < part.minStock) {
        suggestedReorderQty = part.minStock - part.stock;
      }

      const vendorInfo = lastVendorMap.get(part.id);

      return {
        id: part.id,
        name: part.name,
        partNumber: part.partNumber,
        category: part.category?.name || "Uncategorized",
        stock: part.stock,
        minStock: part.minStock,
        purchasePrice: n(part.purchasePrice),
        salePrice: n(part.salePrice),
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        estimatedDaysLeft,
        severity,
        suggestedReorderQty,
        lastVendor: vendorInfo?.vendor ?? null,
        lastPurchasePrice: vendorInfo?.price ?? null,
      };
    });

    // Sort by urgency
    alerts.sort((a, b) => {
      const severityOrder = { red: 0, orange: 1, green: 2, safe: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return (a.estimatedDaysLeft ?? 999) - (b.estimatedDaysLeft ?? 999);
    });

    return NextResponse.json({
      alerts,
      totalParts: allParts.length,
      lookbackDays,
      threshold,
    });
  } catch (error) {
    console.error("GET /api/parts/stock-alerts error:", error);
    return NextResponse.json({ error: "Failed to fetch stock alerts" }, { status: 500 });
  }
}
