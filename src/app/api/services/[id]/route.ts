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

    const service = await prisma.$transaction(async (tx) => {
      const current = await tx.service.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) throw new Error("NOT_FOUND");
      if (current.status === "completed" && body.status !== "completed") {
        throw new Error("COMPLETED");
      }

      const data: Record<string, unknown> = {};
      if (body.status) {
        const VALID_SERVICE_STATUSES = ["pending", "in_progress", "completed"];
        if (!VALID_SERVICE_STATUSES.includes(body.status)) {
          throw new Error("INVALID_STATUS");
        }
        data.status = body.status;
      }
      if (body.note !== undefined) data.note = body.note?.trim() || null;

      // If laborCost is being updated, recalculate total atomically
      if (body.laborCost !== undefined) {
        const newLaborCost = Math.max(0, Number(body.laborCost) || 0);
        data.laborCost = newLaborCost;
        const partsTotal = current.items.reduce((sum, item) => sum + n(item.total), 0);
        data.total = round2(partsTotal + newLaborCost);
      }

      return tx.service.update({
        where: { id },
        data,
        include: { items: { include: { part: true } } },
      });
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error("PUT /api/services error:", error);
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return NextResponse.json({ error: "Service not found" }, { status: 404 });
      if (error.message === "COMPLETED") return NextResponse.json({ error: "Cannot edit a completed service" }, { status: 403 });
      if (error.message === "INVALID_STATUS") return NextResponse.json({ error: "Invalid status. Must be one of: pending, in_progress, completed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

// DELETE /api/services/[id] — soft-delete service and reverse stock deductions
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

      // Soft-delete: set deletedAt instead of removing records
      await tx.service.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/services error:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
