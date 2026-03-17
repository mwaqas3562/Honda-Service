import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/job-cards — list all job cards
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { vehicleNumber: { contains: search, mode: "insensitive" } },
        { jobCardNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const jobCards = await prisma.jobCard.findMany({
      where,
      include: { sales: { select: { id: true, total: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(jobCards);
  } catch (error) {
    console.error("GET /api/job-cards error:", error);
    return NextResponse.json({ error: "Failed to fetch job cards" }, { status: 500 });
  }
}

// POST /api/job-cards — create a new job card
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerPhone, vehicleNumber, meterReading, bikeModel, mechanicName, laborCost } = body;

    if (!customerName?.trim()) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!customerPhone?.trim()) return NextResponse.json({ error: "Customer phone is required" }, { status: 400 });
    if (!vehicleNumber?.trim()) return NextResponse.json({ error: "Vehicle number is required" }, { status: 400 });
    if (!bikeModel?.trim()) return NextResponse.json({ error: "Bike model is required" }, { status: 400 });
    if (!mechanicName?.trim()) return NextResponse.json({ error: "Mechanic name is required" }, { status: 400 });
    if (meterReading == null || meterReading < 0) return NextResponse.json({ error: "Meter reading is required" }, { status: 400 });

    // Generate sequential job card number: 01, 02, 03...
    const lastJobCard = await prisma.jobCard.findFirst({
      orderBy: { id: "desc" },
      select: { jobCardNumber: true },
    });

    let nextNum = 1;
    if (lastJobCard?.jobCardNumber) {
      const parsed = parseInt(lastJobCard.jobCardNumber, 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }

    const jobCardNumber = String(nextNum).padStart(2, "0");

    const jobCard = await prisma.jobCard.create({
      data: {
        jobCardNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        meterReading: parseInt(meterReading, 10),
        bikeModel: bikeModel.trim(),
        mechanicName: mechanicName.trim(),
        laborCost: Math.max(0, Number(laborCost) || 0),
        status: "open",
      },
    });

    return NextResponse.json(jobCard, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/job-cards error:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Job card number already exists" }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : "Failed to create job card";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
