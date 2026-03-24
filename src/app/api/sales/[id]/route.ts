import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateWheelBalancerTracking, reverseWheelBalancerTracking } from "@/lib/wheel-balancer";
import { calculateJobCardBonuses, calculateSaleBonuses } from "@/lib/bonus";
import { n } from "@/lib/utils";

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

    const { jobCardId, customer, paymentType, discount, laborCost, items, labourItems, bikeNumber, phone, staffId } = await req.json();

    if ((!Array.isArray(items) || items.length === 0) && (!Array.isArray(labourItems) || labourItems.length === 0)) {
      return NextResponse.json({ error: "At least one part or labour item is required" }, { status: 400 });
    }

    const VALID_PAYMENT_TYPES = ["cash", "card", "credit", "online"];
    if (paymentType && !VALID_PAYMENT_TYPES.includes(paymentType)) {
      return NextResponse.json({ error: `Invalid payment type. Must be one of: ${VALID_PAYMENT_TYPES.join(", ")}` }, { status: 400 });
    }

    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      if (!item.partId) return NextResponse.json({ error: `Item ${i + 1}: Part is required` }, { status: 400 });
      if (!item.quantity || item.quantity <= 0) return NextResponse.json({ error: `Item ${i + 1}: Quantity must be positive` }, { status: 400 });
      if (item.unitPrice == null || item.unitPrice < 0) return NextResponse.json({ error: `Item ${i + 1}: Price must be non-negative` }, { status: 400 });
    }

    let jobCard = null;
    if (jobCardId) {
      jobCard = await prisma.jobCard.findUnique({ where: { id: jobCardId } });
      if (!jobCard) return NextResponse.json({ error: "Job card not found" }, { status: 400 });
    }

    const saleItems = (items || []).map((item: { partId: number; quantity: number; unitPrice: number }) => {
      const qty = Math.max(1, Math.round(item.quantity));
      const price = Math.max(0, item.unitPrice);
      return {
        partId: item.partId,
        quantity: qty,
        unitPrice: price,
        total: Math.round(qty * price * 100) / 100,
      };
    });

    const saleLabourItems = (labourItems || []).map((item: { labourId: number; quantity: number; unitPrice: number }) => {
      const qty = Math.max(1, Math.round(item.quantity));
      const price = Math.max(0, item.unitPrice);
      return {
        labourId: item.labourId,
        quantity: qty,
        unitPrice: price,
        total: Math.round(qty * price * 100) / 100,
      };
    });

    const partsSubtotal = saleItems.reduce((sum: number, i: { total: number }) => sum + i.total, 0);
    const labourSubtotal = saleLabourItems.reduce((sum: number, i: { total: number }) => sum + i.total, 0);
    const labor = labourSubtotal > 0 ? labourSubtotal : Math.max(0, Number(laborCost) || n(jobCard?.laborCost));
    const subtotal = Math.round((partsSubtotal + labor) * 100) / 100;
    const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
    const total = Math.round((subtotal - disc) * 100) / 100;
    const customerName = customer?.trim() || (jobCard?.customerName ?? null);

    const updated = await prisma.$transaction(async (tx) => {
      // Re-validate stock inside transaction to prevent race conditions
      for (let i = 0; i < saleItems.length; i++) {
        const part = await tx.part.findUnique({ where: { id: saleItems[i].partId } });
        if (!part) throw new Error(`Item ${i + 1}: Part not found`);
        if (part.stock < saleItems[i].quantity) {
          throw new Error(`Item ${i + 1} (${part.name}): Insufficient stock. Available: ${part.stock}, Requested: ${saleItems[i].quantity}`);
        }
      }

      await tx.saleItem.deleteMany({ where: { saleId } });
      await tx.saleLabourItem.deleteMany({ where: { saleId } });
      return tx.sale.update({
        where: { id: saleId },
        data: {
          jobCardId: jobCardId || null,
          staffId: (sale.saleType === "quick_service" && staffId !== undefined) ? (staffId || null) : undefined,
          customer: customerName,
          bikeNumber: bikeNumber?.trim() || null,
          phone: phone?.trim() || null,
          laborCost: labor,
          subtotal,
          discount: disc,
          total,
          paymentType: paymentType || "cash",
          items: { create: saleItems },
          labourItems: saleLabourItems.length > 0 ? { create: saleLabourItems } : undefined,
        },
        include: { items: { include: { part: true } }, labourItems: { include: { labour: true } }, jobCard: true, staff: { select: { id: true, name: true } } },
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

      // 3. Lock sale as final FIRST (so bonus calculation sees it as "final")
      const finalSale = await tx.sale.update({
        where: { id: saleId },
        data: { status: "final", finalizedAt: new Date() },
        include: { items: { include: { part: true } }, labourItems: { include: { labour: true } }, jobCard: true, staff: { select: { id: true, name: true } } },
      });

      // 4. Mark job card as completed & calculate bonuses (sale is now "final" in this TX)
      if (sale.jobCardId) {
        await tx.jobCard.update({ where: { id: sale.jobCardId }, data: { status: "completed" } });
        await calculateJobCardBonuses(sale.jobCardId, tx);
      }

      // 5. Calculate bonus for quick_service with assigned staff (no job card needed)
      if (sale.saleType === "quick_service" && sale.staffId && !sale.jobCardId) {
        await calculateSaleBonuses(saleId, tx);
      }

      return finalSale;
    });

    // Track wheel balancer earnings after finalization
    updateWheelBalancerTracking(saleId).catch((e) => console.error("WB tracking error:", e));

    return NextResponse.json(finalized);
  } catch (error) {
    console.error("PATCH /api/sales/:id error:", error);
    const msg = error instanceof Error ? error.message : "Failed to finalize sale";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/sales/:id — soft-delete a draft sale (atomic with WB tracking reversal)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (sale.status === "final") return NextResponse.json({ error: "Cannot delete a finalized invoice" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      // Reverse wheel balancer tracking inside transaction
      await reverseWheelBalancerTracking(saleId, tx);
      // Soft-delete: set deletedAt instead of removing the record
      await tx.sale.update({ where: { id: saleId }, data: { deletedAt: new Date() } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sales/:id error:", error);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
