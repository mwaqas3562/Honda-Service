import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/services/[id] — update service status
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.laborCost !== undefined) data.laborCost = body.laborCost;
    if (body.note !== undefined) data.note = body.note?.trim() || null;

    const service = await prisma.service.update({
      where: { id },
      data,
      include: { items: { include: { part: true } } },
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error("PUT /api/services error:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}
