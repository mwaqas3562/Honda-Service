import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/parts/reorder-suggestions — low stock parts with last purchase info
export async function GET() {
  try {
    const allParts = await prisma.part.findMany({
      orderBy: { stock: "asc" },
    });

    const lowStockParts = allParts.filter((p) => p.stock <= p.minStock);

    // Get last purchase item for each low-stock part
    const suggestions = await Promise.all(
      lowStockParts.map(async (part) => {
        const lastPurchaseItem = await prisma.purchaseItem.findFirst({
          where: { partId: part.id },
          orderBy: { purchase: { createdAt: "desc" } },
          include: { purchase: { include: { vendor: true } } },
        });

        const deficit = part.minStock - part.stock;
        const suggestedQty = Math.max(deficit, part.minStock); // At least minStock quantity

        return {
          id: part.id,
          name: part.name,
          partNumber: part.partNumber,
          stock: part.stock,
          minStock: part.minStock,
          deficit,
          suggestedQty,
          purchasePrice: part.purchasePrice,
          lastVendor: lastPurchaseItem?.purchase?.vendor?.name ?? null,
          lastVendorId: lastPurchaseItem?.purchase?.vendor?.id ?? null,
          lastPurchasePrice: lastPurchaseItem?.unitPrice ?? null,
          lastPurchaseDate: lastPurchaseItem?.purchase?.createdAt ?? null,
          estimatedCost: suggestedQty * (lastPurchaseItem?.unitPrice ?? part.purchasePrice),
        };
      })
    );

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("GET /api/parts/reorder-suggestions error:", error);
    return NextResponse.json({ error: "Failed to fetch reorder suggestions" }, { status: 500 });
  }
}
