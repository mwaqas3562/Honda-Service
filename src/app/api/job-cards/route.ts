import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

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

    const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100") || 100, 1), 500);
    const skip = (page - 1) * limit;

    const [jobCards, total] = await Promise.all([
      prisma.jobCard.findMany({
        where,
        include: {
          sales: { select: { id: true, total: true, status: true } },
          staffAssignments: { include: { staff: { select: { id: true, name: true, role: true, bonusConfig: { select: { minJobcardAmount: true, bonusValue: true, active: true } } } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.jobCard.count({ where }),
    ]);
    return NextResponse.json({ data: jobCards, total, page, limit });
  } catch (error) {
    console.error("GET /api/job-cards error:", error);
    return NextResponse.json({ error: "Failed to fetch job cards" }, { status: 500 });
  }
}

// POST /api/job-cards — create a new job card
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerPhone, vehicleNumber, meterReading, bikeModel, laborCost, staffAssignments } = body;

    if (!customerName?.trim()) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!customerPhone?.trim()) return NextResponse.json({ error: "Customer phone is required" }, { status: 400 });
    if (!vehicleNumber?.trim()) return NextResponse.json({ error: "Vehicle number is required" }, { status: 400 });
    if (!bikeModel?.trim()) return NextResponse.json({ error: "Bike model is required" }, { status: 400 });
    if (meterReading == null || meterReading < 0) return NextResponse.json({ error: "Meter reading is required" }, { status: 400 });
    if (!Array.isArray(staffAssignments) || staffAssignments.length === 0) return NextResponse.json({ error: "At least one staff must be assigned" }, { status: 400 });

    // Check for duplicate staff IDs
    const staffIds = staffAssignments.map((s: { staffId: number }) => s.staffId);
    if (new Set(staffIds).size !== staffIds.length) return NextResponse.json({ error: "Duplicate staff assignment" }, { status: 400 });

    // Atomic job card number generation with retry on unique constraint violation
    const MAX_RETRIES = 3;
    let jobCard = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        jobCard = await prisma.$transaction(async (tx) => {
          // Get next number atomically inside transaction
          const last = await tx.jobCard.findFirst({
            orderBy: { id: "desc" },
            select: { jobCardNumber: true },
          });
          let nextNum = 1;
          if (last?.jobCardNumber) {
            const parsed = parseInt(last.jobCardNumber, 10);
            if (!isNaN(parsed)) nextNum = parsed + 1;
          }
          const jobCardNumber = String(nextNum).padStart(2, "0");

          return tx.jobCard.create({
            data: {
              jobCardNumber,
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              vehicleNumber: vehicleNumber.trim().toUpperCase(),
              meterReading: parseInt(meterReading, 10),
              bikeModel: bikeModel.trim(),
              laborCost: Math.max(0, Number(laborCost) || 0),
              status: "open",
              staffAssignments: {
                create: staffAssignments.map((s: { staffId: number; labourType?: string; hoursSpent?: number }) => ({
                  staffId: s.staffId,
                  labourType: s.labourType?.trim() || null,
                  hoursSpent: s.hoursSpent != null ? Number(s.hoursSpent) : null,
                })),
              },
            },
            include: {
              staffAssignments: { include: { staff: { select: { id: true, name: true, role: true, bonusConfig: { select: { minJobcardAmount: true, bonusValue: true, active: true } } } } } },
            },
          });
        });
        break; // Success — exit retry loop
      } catch (err: unknown) {
        const isUniqueViolation = typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
        if (isUniqueViolation && attempt < MAX_RETRIES - 1) continue; // Retry
        throw err; // Final attempt or non-unique error — rethrow
      }
    }

    return NextResponse.json(jobCard, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/job-cards error:", error);
    const msg = error instanceof Error ? error.message : "Failed to create job card";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
