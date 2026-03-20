import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/staff/[id]/bonus-config — get bonus config for a staff member
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staffId = parseInt(id, 10);
    if (isNaN(staffId)) {
      return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
    }

    const config = await prisma.staffBonusConfig.findUnique({
      where: { staffId },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("GET bonus-config error:", error);
    return NextResponse.json({ error: "Failed to fetch bonus config" }, { status: 500 });
  }
}

// PUT /api/staff/[id]/bonus-config — create or update bonus config
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staffId = parseInt(id, 10);
    if (isNaN(staffId)) {
      return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
    }

    // Verify staff exists
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const body = await req.json();
    const { minJobcardAmount, bonusType, bonusValue, active } = body;

    if (minJobcardAmount == null || Number(minJobcardAmount) < 0) {
      return NextResponse.json({ error: "Min job card amount must be >= 0" }, { status: 400 });
    }
    if (!bonusType || bonusType !== "percentage") {
      return NextResponse.json({ error: "Bonus type must be 'percentage'" }, { status: 400 });
    }
    if (bonusValue == null || Number(bonusValue) <= 0) {
      return NextResponse.json({ error: "Bonus value must be > 0" }, { status: 400 });
    }
    if (bonusType === "percentage" && Number(bonusValue) > 100) {
      return NextResponse.json({ error: "Percentage cannot exceed 100" }, { status: 400 });
    }

    const config = await prisma.staffBonusConfig.upsert({
      where: { staffId },
      create: {
        staffId,
        minJobcardAmount: Number(minJobcardAmount),
        bonusType,
        bonusValue: Number(bonusValue),
        active: active !== false,
      },
      update: {
        minJobcardAmount: Number(minJobcardAmount),
        bonusType,
        bonusValue: Number(bonusValue),
        active: active !== false,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("PUT bonus-config error:", error);
    return NextResponse.json({ error: "Failed to save bonus config" }, { status: 500 });
  }
}

// DELETE /api/staff/[id]/bonus-config — remove bonus config
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staffId = parseInt(id, 10);
    if (isNaN(staffId)) {
      return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
    }

    await prisma.staffBonusConfig.deleteMany({ where: { staffId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE bonus-config error:", error);
    return NextResponse.json({ error: "Failed to delete bonus config" }, { status: 500 });
  }
}
