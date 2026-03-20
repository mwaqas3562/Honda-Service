import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/staff/[id]/advances?month=2026-03
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { searchParams } = _req.nextUrl;
    const month = searchParams.get("month");

    const where: Record<string, unknown> = { staffId };
    if (month) {
      const [y, m] = month.split("-").map(Number);
      if (!y || !m) return NextResponse.json({ error: "Invalid month format" }, { status: 400 });
      where.date = {
        gte: new Date(y, m - 1, 1),
        lt: new Date(y, m, 1),
      };
    }

    const records = await prisma.staffAdvance.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET advances error:", error);
    return NextResponse.json({ error: "Failed to fetch advances" }, { status: 500 });
  }
}

// POST /api/staff/[id]/advances — add an advance
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const { amount, date, note } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }
    if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

    // Check if month is locked
    const d = new Date(date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lock = await prisma.salaryLock.findUnique({ where: { month } });
    if (lock) {
      return NextResponse.json({ error: `Month ${month} is locked` }, { status: 403 });
    }

    const record = await prisma.staffAdvance.create({
      data: {
        staffId,
        amount: Number(amount),
        date: new Date(date),
        note: note?.trim() || null,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST advance error:", error);
    return NextResponse.json({ error: "Failed to save advance" }, { status: 500 });
  }
}

// DELETE /api/staff/[id]/advances?advanceId=123
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const advanceId = parseInt(req.nextUrl.searchParams.get("advanceId") || "");
    if (isNaN(advanceId)) return NextResponse.json({ error: "advanceId required" }, { status: 400 });

    // Verify ownership
    const adv = await prisma.staffAdvance.findUnique({ where: { id: advanceId } });
    if (!adv || adv.staffId !== staffId) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 });
    }

    // Check if month is locked
    const month = `${adv.date.getFullYear()}-${String(adv.date.getMonth() + 1).padStart(2, "0")}`;
    const lock = await prisma.salaryLock.findUnique({ where: { month } });
    if (lock) {
      return NextResponse.json({ error: `Month ${month} is locked` }, { status: 403 });
    }

    await prisma.staffAdvance.delete({ where: { id: advanceId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE advance error:", error);
    return NextResponse.json({ error: "Failed to delete advance" }, { status: 500 });
  }
}
