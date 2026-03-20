import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/wheel-balancer/config — get the wheel balancer config
export async function GET() {
  try {
    const wb = await prisma.staff.findFirst({
      where: { role: "wheel_balancer", status: "active" },
      include: { wbConfig: true },
    });

    if (!wb) {
      return NextResponse.json({ error: "No active Wheel Balancer staff found" }, { status: 404 });
    }

    return NextResponse.json({
      staffId: wb.id,
      staffName: wb.name,
      config: wb.wbConfig || null,
    });
  } catch (error) {
    console.error("GET /api/wheel-balancer/config error:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

// PUT /api/wheel-balancer/config — create or update config
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { bonusThreshold, bonusType, bonusValue, active } = body;

    const wb = await prisma.staff.findFirst({
      where: { role: "wheel_balancer", status: "active" },
    });

    if (!wb) {
      return NextResponse.json({ error: "No active Wheel Balancer staff found" }, { status: 404 });
    }

    if (bonusThreshold != null && (isNaN(bonusThreshold) || bonusThreshold < 1)) {
      return NextResponse.json({ error: "Bonus threshold must be >= 1" }, { status: 400 });
    }
    if (bonusType && !["flat", "percentage"].includes(bonusType)) {
      return NextResponse.json({ error: "Bonus type must be 'flat' or 'percentage'" }, { status: 400 });
    }
    if (bonusValue != null && Number(bonusValue) < 0) {
      return NextResponse.json({ error: "Bonus value must be >= 0" }, { status: 400 });
    }
    if (bonusType === "percentage" && Number(bonusValue) > 100) {
      return NextResponse.json({ error: "Percentage cannot exceed 100" }, { status: 400 });
    }

    const config = await prisma.wheelBalancerConfig.upsert({
      where: { staffId: wb.id },
      create: {
        staffId: wb.id,
        bonusThreshold: Number(bonusThreshold) || 100,
        bonusType: bonusType || "flat",
        bonusValue: Number(bonusValue) || 0,
        active: active !== false,
      },
      update: {
        ...(bonusThreshold != null && { bonusThreshold: Number(bonusThreshold) }),
        ...(bonusType && { bonusType }),
        ...(bonusValue != null && { bonusValue: Number(bonusValue) }),
        ...(active != null && { active }),
      },
    });

    return NextResponse.json({ staffId: wb.id, staffName: wb.name, config });
  } catch (error) {
    console.error("PUT /api/wheel-balancer/config error:", error);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
