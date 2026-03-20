import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

const MAX_PAID_LEAVES = 2; // max paid leaves per month
const MIN_PRESENT_FOR_PL = 15; // need >= 15 present days to qualify

// GET /api/salary?month=2026-03
// DAILY WAGE — paid only for present days + earned paid leaves.
//   perDayWage = round(baseSalary / totalDays)
//   paidLeaves = presentDays >= 15 ? min(2, absentDays) : 0
//   paidDays   = presentDays + paidLeaves
//   salary     = paidDays * perDayWage
//   finalSalary = salary + bonus - advance
export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
    }

    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 1);

    const lock = await prisma.salaryLock.findUnique({ where: { month } });

    const allStaff = await prisma.staff.findMany({
      include: { bonusConfig: true },
      orderBy: { name: "asc" },
    });

    const [attendanceAll, advancesAll, bonusLogsAll] = await Promise.all([
      prisma.staffAttendance.findMany({
        where: { date: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.staffAdvance.findMany({
        where: { date: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.staffBonusLog.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
      }),
    ]);

    // Group by staffId
    const attendanceByStaff = new Map<number, typeof attendanceAll>();
    for (const a of attendanceAll) {
      const arr = attendanceByStaff.get(a.staffId) || [];
      arr.push(a);
      attendanceByStaff.set(a.staffId, arr);
    }

    const advancesByStaff = new Map<number, number>();
    for (const adv of advancesAll) {
      advancesByStaff.set(adv.staffId, (advancesByStaff.get(adv.staffId) || 0) + n(adv.amount));
    }

    const bonusByStaff = new Map<number, number>();
    for (const bl of bonusLogsAll) {
      bonusByStaff.set(bl.staffId, (bonusByStaff.get(bl.staffId) || 0) + n(bl.bonusAmount));
    }

    const daysInMonth = new Date(year, mon, 0).getDate();

    const rows = allStaff.map((s) => {
      const baseSalary = n(s.baseSalary);
      const perDayWage = Math.round(baseSalary / daysInMonth);
      const attendance = attendanceByStaff.get(s.id) || [];
      const presentDays = attendance.filter((a) => a.status === "present").length;
      const absentDays = attendance.filter((a) => a.status === "absent").length;

      // Conditional paid leaves: only if present >= 15 days
      const paidLeaves = presentDays >= MIN_PRESENT_FOR_PL
        ? Math.min(MAX_PAID_LEAVES, absentDays)
        : 0;

      const paidDays = presentDays + paidLeaves;
      const salary = paidDays * perDayWage;
      const bonus = bonusByStaff.get(s.id) || 0;
      const advances = advancesByStaff.get(s.id) || 0;
      const finalSalary = Math.max(0, salary + bonus - advances);

      return {
        staffId: s.id,
        name: s.name,
        role: s.role,
        status: s.status,
        baseSalary,
        perDayWage,
        presentDays,
        absentDays,
        paidLeaves,
        paidDays,
        salary: Math.round(salary * 100) / 100,
        bonus: Math.round(bonus * 100) / 100,
        advances: Math.round(advances * 100) / 100,
        finalSalary: Math.round(finalSalary * 100) / 100,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        baseSalary: acc.baseSalary + r.baseSalary,
        salary: acc.salary + r.salary,
        bonus: acc.bonus + r.bonus,
        advances: acc.advances + r.advances,
        finalSalary: acc.finalSalary + r.finalSalary,
      }),
      { baseSalary: 0, salary: 0, bonus: 0, advances: 0, finalSalary: 0 }
    );

    return NextResponse.json({
      month,
      daysInMonth,
      paidLeaves: MAX_PAID_LEAVES,
      minPresentForPL: MIN_PRESENT_FOR_PL,
      locked: !!lock,
      lockedAt: lock?.lockedAt || null,
      rows,
      totals: {
        baseSalary: Math.round(totals.baseSalary * 100) / 100,
        salary: Math.round(totals.salary * 100) / 100,
        bonus: Math.round(totals.bonus * 100) / 100,
        advances: Math.round(totals.advances * 100) / 100,
        finalSalary: Math.round(totals.finalSalary * 100) / 100,
      },
    });
  } catch (error) {
    console.error("GET /api/salary error:", error);
    return NextResponse.json(
      { error: "Failed to compute salary", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
