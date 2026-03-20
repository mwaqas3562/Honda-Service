import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/salary/lock — lock a month
export async function POST(req: NextRequest) {
  try {
    const { month } = await req.json();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
    }

    const existing = await prisma.salaryLock.findUnique({ where: { month } });
    if (existing) {
      return NextResponse.json({ error: "Month already locked" }, { status: 409 });
    }

    const lock = await prisma.salaryLock.create({ data: { month } });
    return NextResponse.json(lock, { status: 201 });
  } catch (error) {
    console.error("POST /api/salary/lock error:", error);
    return NextResponse.json({ error: "Failed to lock month" }, { status: 500 });
  }
}

// DELETE /api/salary/lock?month=2026-03 — unlock a month
export async function DELETE(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month");
    if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

    const existing = await prisma.salaryLock.findUnique({ where: { month } });
    if (!existing) {
      return NextResponse.json({ error: "Month is not locked" }, { status: 404 });
    }

    await prisma.salaryLock.delete({ where: { month } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/salary/lock error:", error);
    return NextResponse.json({ error: "Failed to unlock month" }, { status: 500 });
  }
}
