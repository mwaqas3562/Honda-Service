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
    });

    if (existingPart) {
      // Part exists → update stock + weighted average price
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

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const newPart = await prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          name: name.trim(),
          partNumber: partNumber.trim(),
          category: category.trim(),
          purchasePrice: round2(purchasePrice),
          salePrice: round2(salePrice ?? 0),
          stock: quantity,
          minStock: minStock ?? 5,
        },
      });

      await tx.stockLog.create({
        data: {
          partId: part.id,
          type: "purchase",
          quantity,
          prevStock: 0,
          newStock: quantity,
          purchasePrice: round2(purchasePrice),
          prevPrice: 0,
          note: note || `Initial stock: ${quantity} units @ Rs ${purchasePrice}`,
        },
      });

      return part;
    });

    return NextResponse.json(
      {
        action: "created",
        message: `New part "${newPart.name}" created with ${quantity} units @ Rs ${round2(purchasePrice)}`,
        data: {
          partId: newPart.id,
          partName: newPart.name,
          prevStock: 0,
          newStock: quantity,
          addedQuantity: quantity,
          prevPrice: 0,
          newPrice: round2(purchasePrice),
          purchasePrice: round2(purchasePrice),
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
