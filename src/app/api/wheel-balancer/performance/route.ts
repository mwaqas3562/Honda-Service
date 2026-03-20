import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

// GET /api/wheel-balancer/performance — get performance data with filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const month = searchParams.get("month"); // "2026-03" or null for all
    const from = searchParams.get("from"); // "2026-01" for range start
    const to = searchParams.get("to"); // "2026-03" for range end

    const wb = await prisma.staff.findFirst({
      where: { role: "wheel_balancer", status: "active" },
      include: { wbConfig: true },
    });

    if (!wb) {
      return NextResponse.json({ error: "No active Wheel Balancer staff found" }, { status: 404 });
    }

    // Build month filter
    const where: Record<string, unknown> = { staffId: wb.id };
    if (month) {
      where.month = month;
    } else if (from || to) {
      const monthFilter: Record<string, string> = {};
      if (from) monthFilter.gte = from;
      if (to) monthFilter.lte = to;
      where.month = monthFilter;
    }

    const performance = await prisma.wheelBalancerPerformance.findMany({
      where,
      orderBy: { month: "desc" },
    });

    // Aggregate totals
    const totalServiceCount = performance.reduce((sum, p) => sum + p.serviceCount, 0);
    const totalEarnings = performance.reduce((sum, p) => sum + n(p.totalEarnings), 0);
    const totalBonus = performance.reduce((sum, p) => sum + n(p.bonusAmount), 0);

    // Current month performance for progress bar
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentPerf = performance.find((p) => p.month === currentMonth) || {
      serviceCount: 0,
      totalEarnings: 0,
      bonusAmount: 0,
    };

    return NextResponse.json({
      staff: { id: wb.id, name: wb.name },
      config: wb.wbConfig || null,
      currentMonth: {
        month: currentMonth,
        serviceCount: currentPerf.serviceCount,
        totalEarnings: currentPerf.totalEarnings,
        bonusAmount: currentPerf.bonusAmount,
      },
      totals: {
        serviceCount: totalServiceCount,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalBonus: Math.round(totalBonus * 100) / 100,
      },
      monthly: performance,
    });
  } catch (error) {
    console.error("GET /api/wheel-balancer/performance error:", error);
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }
}
