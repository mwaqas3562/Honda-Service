import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/labours/:id — update a labour
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const labourId = parseInt(id, 10);
    if (isNaN(labourId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const existing = await prisma.labour.findUnique({ where: { id: labourId } });
    if (!existing) return NextResponse.json({ error: "Labour not found" }, { status: 404 });

    const { name, defaultPrice, notes } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Labour name is required" }, { status: 400 });
    }
    if (defaultPrice == null || Number(defaultPrice) < 0) {
      return NextResponse.json({ error: "Default price must be non-negative" }, { status: 400 });
    }

    const updated = await prisma.labour.update({
      where: { id: labourId },
      data: {
        name: name.trim(),
        defaultPrice: Number(defaultPrice),
        notes: notes?.trim() || null,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/labours/:id error:", error);
    return NextResponse.json({ error: "Failed to update labour" }, { status: 500 });
  }
}

// DELETE /api/labours/:id — delete a labour
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const labourId = parseInt(id, 10);
    if (isNaN(labourId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const existing = await prisma.labour.findUnique({ where: { id: labourId } });
    if (!existing) return NextResponse.json({ error: "Labour not found" }, { status: 404 });

    await prisma.labour.delete({ where: { id: labourId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/labours/:id error:", error);
    return NextResponse.json({ error: "Failed to delete labour" }, { status: 500 });
  }
}
