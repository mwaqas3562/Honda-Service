import { prisma } from "@/lib/prisma";

type StockChangeType = "purchase" | "sale" | "service" | "adjustment";

interface StockChangeResult {
  partId: number;
  prevStock: number;
  newStock: number;
  quantity: number;
  type: StockChangeType;
}

interface StockEntryResult {
  partId: number;
  partName: string;
  prevStock: number;
  newStock: number;
  addedQuantity: number;
  prevPrice: number;
  newPrice: number;
  purchasePrice: number;
}

/**
 * Round a number to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Smart stock entry: adds stock and calculates weighted average purchase price.
 * All reads and writes happen inside an interactive transaction to prevent race conditions.
 */
export async function addStockEntry(
  partId: number,
  addedQuantity: number,
  batchPurchasePrice: number,
  note?: string
): Promise<StockEntryResult> {
  if (addedQuantity <= 0) throw new Error("Quantity must be greater than zero");
  if (batchPurchasePrice < 0) throw new Error("Purchase price cannot be negative");

  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({ where: { id: partId } });
    if (!part) throw new Error("Part not found");

    const prevStock = part.stock;
    const prevPrice = part.purchasePrice;
    const newStock = prevStock + addedQuantity;

    const newAvgPrice = round2(
      ((prevStock * prevPrice) + (addedQuantity * batchPurchasePrice)) / newStock
    );

    await tx.part.update({
      where: { id: partId },
      data: { stock: newStock, purchasePrice: newAvgPrice },
    });

    await tx.stockLog.create({
      data: {
        partId,
        type: "purchase",
        quantity: addedQuantity,
        prevStock,
        newStock,
        purchasePrice: batchPurchasePrice,
        prevPrice,
        note: note || `Added ${addedQuantity} units @ Rs ${batchPurchasePrice}`,
      },
    });

    return {
      partId,
      partName: part.name,
      prevStock,
      newStock,
      addedQuantity,
      prevPrice: round2(prevPrice),
      newPrice: newAvgPrice,
      purchasePrice: batchPurchasePrice,
    };
  });
}

/**
 * Increase stock for a part (e.g. on purchase/restocking).
 * Uses interactive transaction to prevent race conditions.
 */
export async function increaseStock(
  partId: number,
  quantity: number,
  type: StockChangeType = "purchase",
  note?: string
): Promise<StockChangeResult> {
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");

  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({ where: { id: partId } });
    if (!part) throw new Error("Part not found");

    const prevStock = part.stock;
    const newStock = prevStock + quantity;

    await tx.part.update({
      where: { id: partId },
      data: { stock: newStock },
    });

    await tx.stockLog.create({
      data: {
        partId,
        type,
        quantity,
        prevStock,
        newStock,
        note: note || `Stock increased by ${quantity}`,
      },
    });

    return { partId, prevStock, newStock, quantity, type };
  });
}

/**
 * Decrease stock for a part (e.g. on sale/service).
 * Uses interactive transaction to prevent race conditions.
 */
export async function decreaseStock(
  partId: number,
  quantity: number,
  type: StockChangeType = "sale",
  note?: string
): Promise<StockChangeResult> {
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");

  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({ where: { id: partId } });
    if (!part) throw new Error("Part not found");

    if (part.stock < quantity) {
      throw new Error(
        `Insufficient stock. Available: ${part.stock}, Requested: ${quantity}`
      );
    }

    const prevStock = part.stock;
    const newStock = prevStock - quantity;

    await tx.part.update({
      where: { id: partId },
      data: { stock: newStock },
    });

    await tx.stockLog.create({
      data: {
        partId,
        type,
        quantity: -quantity,
        prevStock,
        newStock,
        note: note || `Stock decreased by ${quantity}`,
      },
    });

    return { partId, prevStock, newStock, quantity, type };
  });
}

/**
 * Set stock to an exact value (for manual adjustments).
 * Uses interactive transaction to prevent race conditions.
 */
export async function adjustStock(
  partId: number,
  newStockValue: number,
  note?: string
): Promise<StockChangeResult> {
  if (newStockValue < 0) throw new Error("Stock cannot be negative");

  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({ where: { id: partId } });
    if (!part) throw new Error("Part not found");

    const prevStock = part.stock;
    const quantity = newStockValue - prevStock;

    await tx.part.update({
      where: { id: partId },
      data: { stock: newStockValue },
    });

    await tx.stockLog.create({
      data: {
        partId,
        type: "adjustment",
        quantity,
        prevStock,
        newStock: newStockValue,
        note: note || `Stock adjusted from ${prevStock} to ${newStockValue}`,
      },
    });

    return { partId, prevStock, newStock: newStockValue, quantity, type: "adjustment" };
  });
}
