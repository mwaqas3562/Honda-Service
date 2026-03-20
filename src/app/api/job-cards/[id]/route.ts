import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateJobCardBonuses } from "@/lib/bonus";

// GET /api/job-cards/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jobCard = await prisma.jobCard.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        sales: { include: { items: { include: { part: true } } } },
        staffAssignments: { include: { staff: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (!jobCard) return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    return NextResponse.json(jobCard);
  } catch (error) {
    console.error("GET /api/job-cards/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch job card" }, { status: 500 });
  }
}

// PUT /api/job-cards/[id] — update job card
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jobCardId = parseInt(id, 10);
    const body = await req.json();
    const { customerName, customerPhone, vehicleNumber, meterReading, bikeModel, laborCost, status, staffAssignments } = body;

    // If staffAssignments provided, validate
    if (staffAssignments !== undefined) {
      if (!Array.isArray(staffAssignments) || staffAssignments.length === 0) {
        return NextResponse.json({ error: "At least one staff must be assigned" }, { status: 400 });
      }
      const staffIds = staffAssignments.map((s: { staffId: number }) => s.staffId);
      if (new Set(staffIds).size !== staffIds.length) {
        return NextResponse.json({ error: "Duplicate staff assignment" }, { status: 400 });
      }
    }

    // All updates in a single transaction for atomicity
    const updated = await prisma.$transaction(async (tx) => {
      await tx.jobCard.update({
        where: { id: jobCardId },
        data: {
          ...(customerName && { customerName: customerName.trim() }),
          ...(customerPhone && { customerPhone: customerPhone.trim() }),
          ...(vehicleNumber && { vehicleNumber: vehicleNumber.trim().toUpperCase() }),
          ...(meterReading != null && { meterReading: Math.max(0, parseInt(meterReading, 10)) }),
          ...(bikeModel && { bikeModel: bikeModel.trim() }),
          ...(laborCost != null && { laborCost: Math.max(0, Number(laborCost)) }),
          ...(status && { status }),
        },
      });

      // Replace staff assignments if provided
      if (staffAssignments !== undefined) {
        await tx.jobCardStaff.deleteMany({ where: { jobCardId } });
        await tx.jobCardStaff.createMany({
          data: staffAssignments.map((s: { staffId: number; labourType?: string; hoursSpent?: number }) => ({
            jobCardId,
            staffId: s.staffId,
            labourType: s.labourType?.trim() || null,
            hoursSpent: s.hoursSpent != null ? Number(s.hoursSpent) : null,
          })),
        });
      }

      // Calculate bonuses when job card is marked completed
      if (status === "completed") {
        await calculateJobCardBonuses(jobCardId, tx);
      }

      return tx.jobCard.findUnique({
        where: { id: jobCardId },
        include: {
          staffAssignments: { include: { staff: { select: { id: true, name: true, role: true } } } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/job-cards/[id] error:", error);
    return NextResponse.json({ error: "Failed to update job card" }, { status: 500 });
  }
}

// DELETE /api/job-cards/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.jobCard.delete({ where: { id: parseInt(id, 10) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/job-cards/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete job card" }, { status: 500 });
  }
}
