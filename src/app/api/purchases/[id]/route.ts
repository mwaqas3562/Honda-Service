import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { round2, n } from "@/lib/utils";

const VALID_STATUSES = ["ordered", "in_transit", "received"] as const;

// Allowed transitions: ordered → in_transit → received (and direct ordered → received)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ordered: ["in_transit", "received"],
  in_transit: ["received"],
  received: [], // terminal state
};

/**
 * PATCH /api/purchases/[id]
 * - Status change only: { status: "in_transit" }
 * - Status → received with adjusted items: { status: "received", items: [{partId, quantity, unitPrice}] }
 * - Edit items (ordered/in_transit only): { items: [{partId, quantity, unitPrice}] }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid purchase ID" }, { status: 400 });
    }

    const body = await req.json();
    const { status: rawStatus, items } = body as {
      status?: string;
      items?: { partId: number; quantity: number; unitPrice: number }[];
    };

    // Must provide at least one of status or items
    if (!rawStatus && !items) {
      return NextResponse.json({ error: "Provide status or items to update" }, { status: 400 });
    }

    if (rawStatus && !VALID_STATUSES.includes(rawStatus as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const status = rawStatus as typeof VALID_STATUSES[number] | undefined;

    // Fetch current purchase with items
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: { include: { part: true } },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // Block any edits on received purchases
    if (purchase.status === "received") {
      return NextResponse.json(
        { error: "Cannot modify a received purchase" },
        { status: 400 }
      );
    }

    // Validate status transition if status provided
    if (status) {
      const allowed = ALLOWED_TRANSITIONS[purchase.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot change status from "${purchase.status}" to "${status}"` },
          { status: 400 }
        );
      }
    }

    // Validate items if provided
    if (items) {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "Items array must not be empty" }, { status: 400 });
      }
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.partId || !item.quantity || item.quantity < 0 || !item.unitPrice || item.unitPrice < 0) {
          return NextResponse.json(
            { error: `Item ${i + 1}: partId, quantity (>0), and unitPrice (>0) are required` },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If items provided, replace all purchase items
      if (items) {
        // Delete existing items
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

        // Create new items
        const newItems = items.map((item) => ({
          purchaseId: id,
          partId: item.partId,
          quantity: Math.round(item.quantity),
          unitPrice: round2(item.unitPrice),
          total: round2(Math.round(item.quantity) * round2(item.unitPrice)),
        }));

        await tx.purchaseItem.createMany({ data: newItems });

        // Recalculate total
        const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
        await tx.purchase.update({
          where: { id },
          data: { total: round2(newTotal), ...(status ? { status } : {}) },
        });
      } else if (status) {
        // Status-only update
        await tx.purchase.update({
          where: { id },
          data: { status },
        });
      }

      // If transitioning to "received", update stock
      if (status === "received") {
        // Re-fetch the current items (may have been replaced above)
        const currentItems = await tx.purchaseItem.findMany({
          where: { purchaseId: id },
          include: { part: true },
        });

        for (const item of currentItems) {
          if (item.quantity <= 0) continue;
          const part = await tx.part.findUnique({ where: { id: item.partId } });
          if (!part) continue;

          const prevStock = part.stock;
          const newStock = prevStock + item.quantity;

          const newAvgPrice =
            newStock > 0
              ? round2(
                  (prevStock * n(part.purchasePrice) +
                    item.quantity * n(item.unitPrice)) /
                    newStock
                )
              : n(item.unitPrice);

          await tx.part.update({
            where: { id: item.partId },
            data: { stock: newStock, purchasePrice: newAvgPrice },
          });

          await tx.stockLog.create({
            data: {
              partId: item.partId,
              type: "purchase",
              quantity: item.quantity,
              prevStock,
              newStock,
              purchasePrice: n(item.unitPrice),
              prevPrice: part.purchasePrice,
              note: `Purchase #${purchase.id} from ${purchase.vendor.name} (received)`,
            },
          });
        }
      }

      // Return updated purchase
      return tx.purchase.findUnique({
        where: { id },
        include: {
          vendor: true,
          items: { include: { part: true } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/purchases/[id] error:", error);
    const msg = error instanceof Error ? error.message : "Failed to update purchase";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/purchases/[id]
 * Soft-delete a purchase (only if not received).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid purchase ID" }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({ where: { id } });
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (purchase.status === "received") {
      return NextResponse.json(
        { error: "Cannot delete a received purchase (stock already updated)" },
        { status: 400 }
      );
    }

    await prisma.purchase.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/purchases/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete purchase" }, { status: 500 });
  }
}
