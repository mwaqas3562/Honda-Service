import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/purchases — list purchases
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");

    const purchases = await prisma.purchase.findMany({
      where: vendorId ? { vendorId: parseInt(vendorId, 10) } : undefined,
      include: {
        vendor: true,
        items: { include: { part: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error("GET /api/purchases error:", error);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

// POST /api/purchases — create purchase + update stock with avg cost (all in one transaction)
export async function POST(req: NextRequest) {
  try {
    const { vendorId, status, note, items } = await req.json();

    if (!vendorId) return NextResponse.json({ error: "Vendor is required" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.partId) return NextResponse.json({ error: `Item ${i + 1}: Part is required` }, { status: 400 });
      if (!item.quantity || item.quantity <= 0) return NextResponse.json({ error: `Item ${i + 1}: Quantity must be positive` }, { status: 400 });
      if (item.unitPrice == null || item.unitPrice < 0) return NextResponse.json({ error: `Item ${i + 1}: Unit price must be non-negative` }, { status: 400 });
    }

    const purchaseItems = items.map((item: { partId: number; quantity: number; unitPrice: number }) => ({
      partId: item.partId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: round2(item.quantity * item.unitPrice),
    }));

    const total = purchaseItems.reduce((sum: number, i: { total: number }) => sum + i.total, 0);
    const purchaseStatus = status || "received";

    // Single transaction: create purchase + update stock (if received)
    const purchase = await prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          vendorId,
          status: purchaseStatus,
          total: round2(total),
          note: note?.trim() || null,
          items: { create: purchaseItems },
        },
        include: { vendor: true, items: { include: { part: true } } },
      });

      if (purchaseStatus === "received") {
        for (const item of purchaseItems) {
          const part = await tx.part.findUnique({ where: { id: item.partId } });
          if (!part) throw new Error(`Part ID ${item.partId} not found`);

          const prevStock = part.stock;
          const newStock = prevStock + item.quantity;
          const newAvgPrice = round2(
            ((prevStock * part.purchasePrice) + (item.quantity * item.unitPrice)) / newStock
          );

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
              purchasePrice: item.unitPrice,
              prevPrice: part.purchasePrice,
              note: `Purchase #${newPurchase.id} from ${vendor.name}`,
            },
          });
        }
      }

      return newPurchase;
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error("POST /api/purchases error:", error);
    const msg = error instanceof Error ? error.message : "Failed to create purchase";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
