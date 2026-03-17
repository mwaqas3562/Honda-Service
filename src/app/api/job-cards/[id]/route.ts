import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/job-cards/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jobCard = await prisma.jobCard.findUnique({
      where: { id: parseInt(id, 10) },
      include: { sales: { include: { items: { include: { part: true } } } } },
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
    const body = await req.json();
    const { customerName, customerPhone, vehicleNumber, meterReading, bikeModel, mechanicName, laborCost, status } = body;

    const jobCard = await prisma.jobCard.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(customerName && { customerName: customerName.trim() }),
        ...(customerPhone && { customerPhone: customerPhone.trim() }),
        ...(vehicleNumber && { vehicleNumber: vehicleNumber.trim().toUpperCase() }),
        ...(meterReading != null && { meterReading: parseInt(meterReading, 10) }),
        ...(bikeModel && { bikeModel: bikeModel.trim() }),
        ...(mechanicName && { mechanicName: mechanicName.trim() }),
        ...(laborCost != null && { laborCost: Math.max(0, Number(laborCost)) }),
        ...(status && { status }),
      },
    });

    return NextResponse.json(jobCard);
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
