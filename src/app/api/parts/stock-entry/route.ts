import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addStockEntry } from "@/lib/stock";

/**
 * POST /api/parts/stock-entry
 *
 * Smart stock entry:
 * - If partNumber exists → update stock qty + weighted avg purchase price
 * - If partNumber doesn't exist → create new part with given qty and price
 *
 * Body: { partNumber, name?, category?, quantity, purchasePrice, salePrice?, minStock?, note? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      partNumber,
      name,
      category,
      quantity,
      purchasePrice,
      salePrice,
      minStock,
      note,
    } = body;

    // Validation
    if (!partNumber || typeof partNumber !== "string") {
      return NextResponse.json(
        { error: "Part number is required" },
        { status: 400 }
      );
    }
    if (quantity == null || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be a positive number" },
        { status: 400 }
      );
    }
    if (
      purchasePrice == null ||
      typeof purchasePrice !== "number" ||
      purchasePrice < 0
    ) {
      return NextResponse.json(
        { error: "Purchase price must be a non-negative number" },
        { status: 400 }
      );
    }

    // Check if part exists
    const existingPart = await prisma.part.findUnique({
      where: { partNumber: partNumber.trim() },
      select: { id: true },
    });

    if (existingPart) {
      // Part exists — addStockEntry validates & updates atomically inside a transaction
      const result = await addStockEntry(
        existingPart.id,
        quantity,
        purchasePrice,
        note
      );

      return NextResponse.json({
        action: "updated",
        message: `Stock updated for "${result.partName}". ${result.prevStock} → ${result.newStock} units. Avg price: Rs ${result.prevPrice} → Rs ${result.newPrice}`,
        data: result,
      });
    }

    // Part doesn't exist → create new record
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required for a new part" },
        { status: 400 }
      );
    }
    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Category is required for a new part" },
        { status: 400 }
      );
    }

    const safeQty = Math.max(1, Math.round(quantity));
    const safePrice = Math.max(0, Math.round(purchasePrice));

    // Resolve category name → categoryId
    const cat = await prisma.category.upsert({
      where: { name: category.trim() },
      update: {},
      create: { name: category.trim() },
    });

    const newPart = await prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          name: name.trim(),
          partNumber: partNumber.trim(),
          categoryId: cat.id,
          purchasePrice: safePrice,
          salePrice: Math.round(salePrice ?? 0),
          stock: safeQty,
          minStock: Math.round(minStock ?? 5),
        },
      });

      await tx.stockLog.create({
        data: {
          partId: part.id,
          type: "purchase",
          quantity: safeQty,
          prevStock: 0,
          newStock: safeQty,
          purchasePrice: safePrice,
          prevPrice: 0,
          note: note || `Initial stock: ${quantity} units @ Rs ${purchasePrice}`,
        },
      });

      return part;
    });

    return NextResponse.json(
      {
        action: "created",
        message: `New part "${newPart.name}" created with ${safeQty} units @ Rs ${safePrice}`,
        data: {
          partId: newPart.id,
          partName: newPart.name,
          prevStock: 0,
          newStock: safeQty,
          addedQuantity: safeQty,
          prevPrice: 0,
          newPrice: safePrice,
          purchasePrice: safePrice,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process stock entry";
    console.error("POST /api/parts/stock-entry error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
