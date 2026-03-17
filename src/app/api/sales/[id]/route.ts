import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/sales/[id] — single sale with full details for invoice
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) return NextResponse.json({ error: "Invalid sale ID" }, { status: 400 });

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: { include: { part: { select: { id: true, name: true, partNumber: true, salePrice: true, stock: true } } } },
        labourItems: { include: { labour: true } },
        jobCard: true,
      },
    });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    return NextResponse.json(sale);
  } catch (error) {
    console.error("GET /api/sales/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

// PUT /api/sales/:id — update a draft sale (parts, qty, price, customer, etc.)
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: true } });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (sale.status === "final") {
      return NextResponse.json({ error: "Cannot edit a finalized invoice" }, { status: 403 });
    }

    const { jobCardId, customer, paymentType, discount, laborCost, items, labourItems } = await req.json();

    if ((!Array.isArray(items) || items.length === 0) && (!Array.isArray(labourItems) || labourItems.length === 0)) {
      return NextResponse.json({ error: "At least one part or labour item is required" }, { status: 400 });
    }

    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      if (!item.partId) return NextResponse.json({ error: `Item ${i + 1}: Part is required` }, { status: 400 });
      if (!item.quantity || item.quantity <= 0) return NextResponse.json({ error: `Item ${i + 1}: Quantity must be positive` }, { status: 400 });
      if (item.unitPrice == null || item.unitPrice < 0) return NextResponse.json({ error: `Item ${i + 1}: Price must be non-negative` }, { status: 400 });
    }

    for (let i = 0; i < (items || []).length; i++) {
      const part = await prisma.part.findUnique({ where: { id: items[i].partId } });
      if (!part) return NextResponse.json({ error: `Item ${i + 1}: Part not found` }, { status: 400 });
      if (part.stock < items[i].quantity) {
        return NextResponse.json(
          { error: `Item ${i + 1} (${part.name}): Insufficient stock. Available: ${part.stock}, Requested: ${items[i].quantity}` },
          { status: 400 }
        );
      }
    }

    let jobCard = null;
    if (jobCardId) {
      jobCard = await prisma.jobCard.findUnique({ where: { id: jobCardId } });
      if (!jobCard) return NextResponse.json({ error: "Job card not found" }, { status: 400 });
    }

    const saleItems = (items || []).map((item: { partId: number; quantity: number; unitPrice: number }) => ({
      partId: item.partId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));

    const saleLabourItems = (labourItems || []).map((item: { labourId: number; quantity: number; unitPrice: number }) => ({
      labourId: item.labourId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));

    const partsSubtotal = saleItems.reduce((sum: number, i: { total: number }) => sum + i.total, 0);
    const labourSubtotal = saleLabourItems.reduce((sum: number, i: { total: number }) => sum + i.total, 0);
    const labor = labourSubtotal > 0 ? labourSubtotal : Math.max(0, Number(laborCost) || (jobCard?.laborCost ?? 0));
    const subtotal = Math.round((partsSubtotal + labor) * 100) / 100;
    const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
    const total = Math.round((subtotal - disc) * 100) / 100;
    const customerName = customer?.trim() || (jobCard?.customerName ?? null);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.saleItem.deleteMany({ where: { saleId } });
      await tx.saleLabourItem.deleteMany({ where: { saleId } });
      return tx.sale.update({
        where: { id: saleId },
        data: {
          jobCardId: jobCardId || null,
          customer: customerName,
          laborCost: labor,
          subtotal,
          discount: disc,
          total,
          paymentType: paymentType || "cash",
          items: { create: saleItems },
          labourItems: saleLabourItems.length > 0 ? { create: saleLabourItems } : undefined,
        },
        include: { items: { include: { part: true } }, labourItems: { include: { labour: true } }, jobCard: true },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/sales/:id error:", error);
    const msg = error instanceof Error ? error.message : "Failed to update sale";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/sales/:id — finalize a draft sale (deduct stock, mark final, lock)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { action } = await req.json();
    if (action !== "finalize") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, jobCard: true },
    });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (sale.status === "final") return NextResponse.json({ error: "Invoice is already finalized" }, { status: 400 });

    const finalized = await prisma.$transaction(async (tx) => {
      // 1. Validate stock
      for (let i = 0; i < sale.items.length; i++) {
        const item = sale.items[i];
        const part = await tx.part.findUnique({ where: { id: item.partId } });
        if (!part) throw new Error(`Part not found for item ${i + 1}`);
        if (part.stock < item.quantity) {
          throw new Error(`${part.name}: Insufficient stock. Available: ${part.stock}, Requested: ${item.quantity}`);
        }
      }

      // 2. Deduct stock, increment usageCount, and create StockLog
      for (const item of sale.items) {
        const part = await tx.part.findUniqueOrThrow({ where: { id: item.partId } });
        const prevStock = part.stock;
        const newStock = prevStock - item.quantity;

        await tx.part.update({
          where: { id: item.partId },
          data: {
            stock: newStock,
            usageCount: { increment: 1 },
          },
        });
        await tx.stockLog.create({
          data: {
            partId: item.partId,
            type: "sale",
            quantity: -item.quantity,
            prevStock,
            newStock,
            note: `Sale #${sale.id}${sale.customer ? ` to ${sale.customer}` : ""} (finalized)`,
          },
        });
      }

      // 3. Mark job card as completed if linked
      if (sale.jobCardId) {
        await tx.jobCard.update({ where: { id: sale.jobCardId }, data: { status: "completed" } });
      }

      // 4. Lock sale as final
      return tx.sale.update({
        where: { id: saleId },
        data: { status: "final", finalizedAt: new Date() },
        include: { items: { include: { part: true } }, labourItems: { include: { labour: true } }, jobCard: true },
      });
    });

    return NextResponse.json(finalized);
  } catch (error) {
    console.error("PATCH /api/sales/:id error:", error);
    const msg = error instanceof Error ? error.message : "Failed to finalize sale";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/sales/:id — delete a draft sale only
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (sale.status === "final") return NextResponse.json({ error: "Cannot delete a finalized invoice" }, { status: 403 });

    await prisma.sale.delete({ where: { id: saleId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sales/:id error:", error);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
