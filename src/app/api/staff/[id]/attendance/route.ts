import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/staff/[id]/attendance?month=2026-03
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { searchParams } = _req.nextUrl;
    const month = searchParams.get("month"); // "2026-03"

    const where: Record<string, unknown> = { staffId };
    if (month) {
      const [y, m] = month.split("-").map(Number);
      if (!y || !m) return NextResponse.json({ error: "Invalid month format (YYYY-MM)" }, { status: 400 });
      where.date = {
        gte: new Date(y, m - 1, 1),
        lt: new Date(y, m, 1),
      };
    }

    const records = await prisma.staffAttendance.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET attendance error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}

// POST /api/staff/[id]/attendance — mark attendance for a date
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const { date, status } = body;

    if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });
    if (!["present", "absent"].includes(status)) {
      return NextResponse.json({ error: "Status must be 'present' or 'absent'" }, { status: 400 });
    }

    // Check if month is locked
    const d = new Date(date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lock = await prisma.salaryLock.findUnique({ where: { month } });
    if (lock) {
      return NextResponse.json({ error: `Month ${month} is locked` }, { status: 403 });
    }

    // Upsert to prevent duplicates
    const record = await prisma.staffAttendance.upsert({
      where: { staffId_date: { staffId, date: new Date(date) } },
      update: { status },
      create: { staffId, date: new Date(date), status },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("POST attendance error:", error);
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}
