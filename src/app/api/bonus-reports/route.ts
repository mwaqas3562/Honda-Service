import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

// GET /api/bonus-reports — unified bonus & wheel balancer reports
// Query params: from, to, staffId, role, bonusType (job_card | wheel_balancer | all)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const staffId = searchParams.get("staffId");
    const role = searchParams.get("role"); // "mechanic" | "wheel_balancer" | "job_card_person" | ""
    const bonusType = searchParams.get("bonusType") || "all"; // "job_card" | "wheel_balancer" | "all"

    // --- Date filter for bonus logs ---
    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (from) {
      dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(from) };
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.createdAt = { ...dateFilter.createdAt, lte: toDate };
    }

    // --- Month range for wheel balancer (YYYY-MM format) ---
    const fromMonth = from ? from.slice(0, 7) : undefined;
    const toMonth = to ? to.slice(0, 7) : undefined;

    // ========== JOB CARD BONUS DATA ==========
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let logs: any[] = [];

    if (bonusType === "all" || bonusType === "job_card") {
      const bonusWhere: Record<string, unknown> = { ...dateFilter };
      if (staffId) {
        const parsed = parseInt(staffId, 10);
        if (isNaN(parsed)) return NextResponse.json({ error: "Invalid staffId" }, { status: 400 });
        bonusWhere.staffId = parsed;
      }
      if (role) {
        bonusWhere.staff = { role };
      }

      logs = await prisma.staffBonusLog.findMany({
        where: bonusWhere,
        include: {
          staff: { select: { id: true, name: true, role: true } },
          jobCard: { select: { id: true, jobCardNumber: true, customerName: true, bikeModel: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // ========== WHEEL BALANCER DATA ==========
    let wbData: {
      staff: { id: number; name: string } | null;
      serviceCount: number;
      totalEarnings: number;
      bonusAmount: number;
      monthly: Array<{
        month: string; serviceCount: number; totalEarnings: number; bonusAmount: number;
      }>;
    } = { staff: null, serviceCount: 0, totalEarnings: 0, bonusAmount: 0, monthly: [] };

    if (bonusType === "all" || bonusType === "wheel_balancer") {
      const wbWhere: Record<string, unknown> = {};
      // If a specific staff is selected and they're a wheel_balancer, use their id
      // If role filter is set and it's NOT wheel_balancer, skip WB data
      if (role && role !== "wheel_balancer") {
        // Don't fetch WB data when filtering by non-WB role
      } else {
        let wbStaffWhere: Record<string, unknown> = { role: "wheel_balancer", status: "active" };
        if (staffId) {
          const parsed = parseInt(staffId, 10);
          if (!isNaN(parsed)) wbStaffWhere = { ...wbStaffWhere, id: parsed };
        }

        const wb = await prisma.staff.findFirst({ where: wbStaffWhere });

        if (wb) {
          wbWhere.staffId = wb.id;
          if (fromMonth || toMonth) {
            const monthFilter: Record<string, string> = {};
            if (fromMonth) monthFilter.gte = fromMonth;
            if (toMonth) monthFilter.lte = toMonth;
            wbWhere.month = monthFilter;
          }

          const performance = await prisma.wheelBalancerPerformance.findMany({
            where: wbWhere,
            orderBy: { month: "desc" },
          });

          wbData = {
            staff: { id: wb.id, name: wb.name },
            serviceCount: performance.reduce((s, p) => s + p.serviceCount, 0),
            totalEarnings: performance.reduce((s, p) => s + n(p.totalEarnings), 0),
            bonusAmount: performance.reduce((s, p) => s + n(p.bonusAmount), 0),
            monthly: performance.map((p) => ({
              month: p.month,
              serviceCount: p.serviceCount,
              totalEarnings: n(p.totalEarnings),
              bonusAmount: n(p.bonusAmount),
            })),
          };
        }
      }
    }

    // ========== BUILD LEADERBOARD ==========
    const staffMap = new Map<number, {
      id: number; name: string; role: string; totalBonus: number; bonusCount: number;
    }>();

    // Add job card bonus entries
    for (const log of logs) {
      const existing = staffMap.get(log.staffId);
      if (existing) {
        existing.totalBonus += n(log.bonusAmount);
        existing.bonusCount += 1;
      } else {
        staffMap.set(log.staffId, {
          id: log.staff.id,
          name: log.staff.name,
          role: log.staff.role,
          totalBonus: n(log.bonusAmount),
          bonusCount: 1,
        });
      }
    }

    // Add wheel balancer bonus to leaderboard
    if (wbData.staff && wbData.bonusAmount > 0) {
      const existing = staffMap.get(wbData.staff.id);
      if (existing) {
        existing.totalBonus += wbData.bonusAmount;
      } else {
        staffMap.set(wbData.staff.id, {
          id: wbData.staff.id,
          name: wbData.staff.name,
          role: "wheel_balancer",
          totalBonus: wbData.bonusAmount,
          bonusCount: wbData.monthly.filter((m) => m.bonusAmount > 0).length,
        });
      }
    }

    const leaderboard = Array.from(staffMap.values()).sort((a, b) => b.totalBonus - a.totalBonus);

    const jobCardBonusTotal = logs.reduce((s, l) => s + n(l.bonusAmount), 0);
    const totalBonusPaid = jobCardBonusTotal + wbData.bonusAmount;
    const eligibleJobCards = logs.length;

    return NextResponse.json({
      leaderboard,
      logs,
      totalBonusPaid,
      totalBonusCount: logs.length + wbData.monthly.filter((m) => m.bonusAmount > 0).length,
      // Breakdown
      jobCardBonus: {
        total: jobCardBonusTotal,
        count: logs.length,
      },
      wheelBalancer: wbData,
      eligibleJobCards,
    });
  } catch (error) {
    console.error("GET /api/bonus-reports error:", error);
    return NextResponse.json({ error: "Failed to fetch bonus reports" }, { status: 500 });
  }
}
