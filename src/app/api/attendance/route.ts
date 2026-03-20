import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/attendance?month=2026-03 — all staff attendance for a month
export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const records = await prisma.staffAttendance.findMany({
      where: {
        date: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
      },
      include: { staff: { select: { id: true, name: true, role: true, status: true } } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}

// POST /api/attendance — bulk mark attendance for a date
// Body: { date: "2026-03-19", entries: [{ staffId: 1, status: "present" }, ...] }
export async function POST(req: NextRequest) {
  try {
    const { date, entries } = await req.json();
    if (!date) return NextResponse.json({ error: "Date required" }, { status: 400 });
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "entries array required" }, { status: 400 });
    }

    // Check lock
    const d = new Date(date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lock = await prisma.salaryLock.findUnique({ where: { month } });
    if (lock) {
      return NextResponse.json({ error: `Month ${month} is locked` }, { status: 403 });
    }

    // Upsert each entry
    const results = await prisma.$transaction(
      entries.map((e: { staffId: number; status: string }) =>
        prisma.staffAttendance.upsert({
          where: { staffId_date: { staffId: e.staffId, date: new Date(date) } },
          update: { status: e.status },
          create: { staffId: e.staffId, date: new Date(date), status: e.status },
        })
      )
    );

    return NextResponse.json({ saved: results.length });
  } catch (error) {
    console.error("POST /api/attendance error:", error);
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}
