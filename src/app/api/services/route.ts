import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/services
export async function GET() {
  try {
    const services = await prisma.service.findMany({
      include: { items: { include: { part: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error("GET /api/services error:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

// POST /api/services — create service + decrease stock (all in one transaction)
export async function POST(req: NextRequest) {
  try {
    const { customerName, customerPhone, bikeModel, bikeRegNo, serviceType, laborCost, note, items } = await req.json();

    if (!customerName?.trim()) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!bikeModel?.trim()) return NextResponse.json({ error: "Bike model is required" }, { status: 400 });
    if (!serviceType?.trim()) return NextResponse.json({ error: "Service type is required" }, { status: 400 });

    const serviceItems = (items || []).map((item: { partId: number; quantity: number; unitPrice: number }) => ({
      partId: item.partId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: round2(item.quantity * item.unitPrice),
    }));

    const partsTotal = serviceItems.reduce((sum: number, i: { total: number }) => sum + i.total, 0);
    const total = partsTotal + (laborCost || 0);

    // Single transaction: create service + validate & deduct stock
    const service = await prisma.$transaction(async (tx) => {
      // Validate stock availability first
      for (let i = 0; i < serviceItems.length; i++) {
        const item = serviceItems[i];
        const part = await tx.part.findUnique({ where: { id: item.partId } });
        if (!part) throw new Error(`Item ${i + 1}: Part not found`);
        if (part.stock < item.quantity) {
          throw new Error(`${part.name}: Insufficient stock. Available: ${part.stock}, Requested: ${item.quantity}`);
        }
      }

      const newService = await tx.service.create({
        data: {
          customerName: customerName.trim(),
          customerPhone: customerPhone?.trim() || null,
          bikeModel: bikeModel.trim(),
          bikeRegNo: bikeRegNo?.trim() || null,
          serviceType: serviceType.trim(),
          status: "pending",
          laborCost: laborCost || 0,
          total: round2(total),
          note: note?.trim() || null,
          items: serviceItems.length > 0 ? { create: serviceItems } : undefined,
        },
        include: { items: { include: { part: true } } },
      });

      // Deduct stock for each part used
      for (const item of serviceItems) {
        const part = await tx.part.findUniqueOrThrow({ where: { id: item.partId } });
        const prevStock = part.stock;
        const newStock = prevStock - item.quantity;

        await tx.part.update({
          where: { id: item.partId },
          data: { stock: newStock },
        });

        await tx.stockLog.create({
          data: {
            partId: item.partId,
            type: "service",
            quantity: -item.quantity,
            prevStock,
            newStock,
            note: `Service #${newService.id}: ${serviceType}`,
          },
        });
      }

      return newService;
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("POST /api/services error:", error);
    const msg = error instanceof Error ? error.message : "Failed to create service";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
