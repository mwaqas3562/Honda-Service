import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { round2, n } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/services/[id] — update service status and/or laborCost (recalculates total)
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.note !== undefined) data.note = body.note?.trim() || null;

    // If laborCost is being updated, recalculate total
    if (body.laborCost !== undefined) {
      const newLaborCost = Math.max(0, Number(body.laborCost) || 0);
      data.laborCost = newLaborCost;

      // Get current service items to recalculate total
      const current = await prisma.service.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) return NextResponse.json({ error: "Service not found" }, { status: 404 });

      const partsTotal = current.items.reduce((sum, item) => sum + n(item.total), 0);
      data.total = round2(partsTotal + newLaborCost);
    }

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

// DELETE /api/services/[id] — cancel service and reverse stock deductions
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const service = await prisma.service.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    if (service.status === "completed") {
      return NextResponse.json({ error: "Cannot delete a completed service" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Reverse stock for each item
      for (const item of service.items) {
        const part = await tx.part.findUniqueOrThrow({ where: { id: item.partId } });
        const prevStock = part.stock;
        const newStock = prevStock + item.quantity;

        await tx.part.update({
          where: { id: item.partId },
          data: { stock: newStock },
        });

        await tx.stockLog.create({
          data: {
            partId: item.partId,
            type: "adjustment",
            quantity: item.quantity,
            prevStock,
            newStock,
            note: `Reversed: Service #${service.id} cancelled`,
          },
        });
      }

      // Delete service items then service
      await tx.serviceItem.deleteMany({ where: { serviceId: id } });
      await tx.service.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/services error:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
