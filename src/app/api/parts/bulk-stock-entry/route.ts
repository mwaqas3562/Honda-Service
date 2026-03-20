import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { round2, n } from "@/lib/utils";

interface BulkItem {
  partId?: number;
  name: string;
  partNumber: string;
  category: string;
  quantity: number;
  purchasePrice: number;
  salePrice?: number;
  minStock?: number;
  note?: string;
}

interface SummaryRow {
  partName: string;
  partNumber: string;
  category: string;
  action: "created" | "updated";
  oldQuantity: number;
  addedQuantity: number;
  newQuantity: number;
  oldPrice: number;
  newAvgPrice: number;
}


/**
 * POST /api/parts/bulk-stock-entry
 *
 * Accepts { items: BulkItem[] }
 * - Merges duplicate partNumbers within the batch (sums qty, weighted avg price)
 * - For each merged item: update existing part or create new
 * - Logs each entry in stock_logs
 * - Returns summary array
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items } = body as { items: BulkItem[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name?.trim()) {
        return NextResponse.json(
          { error: `Item ${i + 1}: Name is required` },
          { status: 400 }
        );
      }
      if (!item.partNumber?.trim() && !item.partId) {
        return NextResponse.json(
          { error: `Item ${i + 1}: Part number or Part ID is required` },
          { status: 400 }
        );
      }
      if (!item.category?.trim() && !item.partId) {
        return NextResponse.json(
          { error: `Item ${i + 1}: Category is required` },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: `Item ${i + 1} (${item.name}): Quantity must be positive` },
          { status: 400 }
        );
      }
      if (item.purchasePrice == null || item.purchasePrice < 0) {
        return NextResponse.json(
          { error: `Item ${i + 1} (${item.name}): Price must be non-negative` },
          { status: 400 }
        );
      }
    }

    // Merge duplicates by partId or partNumber (case-insensitive)
    const merged = new Map<string, BulkItem>();
    for (const item of items) {
      const key = item.partId
        ? `id:${item.partId}`
        : item.partNumber.trim().toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        // Weighted average price for merged quantities
        const totalQty = existing.quantity + item.quantity;
        const avgPrice = round2(
          ((existing.quantity * existing.purchasePrice) +
            (item.quantity * item.purchasePrice)) /
            totalQty
        );
        existing.quantity = totalQty;
        existing.purchasePrice = avgPrice;
        // Keep the first item's other fields, merge notes
        if (item.note) {
          existing.note = existing.note
            ? `${existing.note}; ${item.note}`
            : item.note;
        }
      } else {
        merged.set(key, { ...item });
      }
    }

    const mergedItems = Array.from(merged.values());
    const summary: SummaryRow[] = [];

    // Process all items in a single transaction
    await prisma.$transaction(async (tx) => {
      for (const item of mergedItems) {
        const partNumber = item.partNumber.trim();

        // Look up by partId first (name-search flow), then by partNumber
        const existingPart = item.partId
          ? await tx.part.findUnique({ where: { id: item.partId }, include: { category: true } })
          : await tx.part.findUnique({ where: { partNumber }, include: { category: true } });

        if (existingPart) {
          // Update existing part with weighted average
          const oldQty = existingPart.stock;
          const oldPrice = n(existingPart.purchasePrice);
          const newQty = oldQty + item.quantity;
          const newAvgPrice = round2(
            ((oldQty * oldPrice) + (item.quantity * item.purchasePrice)) /
              newQty
          );

          await tx.part.update({
            where: { id: existingPart.id },
            data: {
              stock: newQty,
              purchasePrice: newAvgPrice,
            },
          });

          await tx.stockLog.create({
            data: {
              partId: existingPart.id,
              type: "purchase",
              quantity: item.quantity,
              prevStock: oldQty,
              newStock: newQty,
              purchasePrice: round2(item.purchasePrice),
              prevPrice: round2(oldPrice),
              note:
                item.note ||
                `Bulk entry: +${item.quantity} units @ Rs ${item.purchasePrice}`,
            },
          });

          summary.push({
            partName: existingPart.name,
            partNumber,
            category: existingPart.category?.name || "Uncategorized",
            action: "updated",
            oldQuantity: oldQty,
            addedQuantity: item.quantity,
            newQuantity: newQty,
            oldPrice: round2(oldPrice),
            newAvgPrice,
          });
        } else {
          // Resolve category name → id
          const cat = await tx.category.upsert({
            where: { name: item.category.trim() },
            update: {},
            create: { name: item.category.trim() },
          });
          // Create new part
          const part = await tx.part.create({
            data: {
              name: item.name.trim(),
              partNumber,
              categoryId: cat.id,
              purchasePrice: round2(item.purchasePrice),
              salePrice: round2(item.salePrice ?? 0),
              stock: item.quantity,
              minStock: item.minStock ?? 5,
            },
          });

          await tx.stockLog.create({
            data: {
              partId: part.id,
              type: "purchase",
              quantity: item.quantity,
              prevStock: 0,
              newStock: item.quantity,
              purchasePrice: round2(item.purchasePrice),
              prevPrice: 0,
              note:
                item.note ||
                `Bulk entry (new): ${item.quantity} units @ Rs ${item.purchasePrice}`,
            },
          });

          summary.push({
            partName: item.name.trim(),
            partNumber,
            category: item.category.trim(),
            action: "created",
            oldQuantity: 0,
            addedQuantity: item.quantity,
            newQuantity: item.quantity,
            oldPrice: 0,
            newAvgPrice: round2(item.purchasePrice),
          });
        }
      }
    });

    const created = summary.filter((s) => s.action === "created").length;
    const updated = summary.filter((s) => s.action === "updated").length;

    return NextResponse.json({
      message: `Processed ${summary.length} item(s): ${created} created, ${updated} updated`,
      summary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process bulk stock entry";
    console.error("POST /api/parts/bulk-stock-entry error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
