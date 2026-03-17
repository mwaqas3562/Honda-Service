import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/sales — list sales with optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const jobCardNumber = searchParams.get("jobCardNumber")?.trim();

    const where: Record<string, unknown> = {};

    // Date range filter
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.date = dateFilter;
    }

    // Job card number filter
    if (jobCardNumber) {
      where.jobCard = { jobCardNumber: { contains: jobCardNumber, mode: "insensitive" } };
    }

    // Customer name search
    if (search) {
      where.OR = [
        { customer: { contains: search, mode: "insensitive" } },
        { jobCard: { customerName: { contains: search, mode: "insensitive" } } },
        { jobCard: { jobCardNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { part: true } },
        labourItems: { include: { labour: true } },
        jobCard: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sales);
  } catch (error) {
    console.error("GET /api/sales error:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

// POST /api/sales — create sale + decrease stock
export async function POST(req: NextRequest) {
  try {
    const { jobCardId, customer, paymentType, discount, laborCost, items, labourItems } = await req.json();

    if ((!Array.isArray(items) || items.length === 0) && (!Array.isArray(labourItems) || labourItems.length === 0)) {
      return NextResponse.json({ error: "At least one part or labour item is required" }, { status: 400 });
    }

    // Validate job card if provided
    let jobCard = null;
    if (jobCardId) {
      jobCard = await prisma.jobCard.findUnique({ where: { id: jobCardId } });
      if (!jobCard) return NextResponse.json({ error: "Job card not found" }, { status: 400 });
    }

    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      if (!item.partId) return NextResponse.json({ error: `Item ${i + 1}: Part is required` }, { status: 400 });
      if (!item.quantity || item.quantity <= 0) return NextResponse.json({ error: `Item ${i + 1}: Quantity must be positive` }, { status: 400 });
      if (item.unitPrice == null || item.unitPrice < 0) return NextResponse.json({ error: `Item ${i + 1}: Price must be non-negative` }, { status: 400 });
    }

    // Validate stock availability upfront before creating sale
    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      const part = await prisma.part.findUnique({ where: { id: item.partId } });
      if (!part) return NextResponse.json({ error: `Item ${i + 1}: Part not found` }, { status: 400 });
      if (part.stock < item.quantity) {
        return NextResponse.json(
          { error: `Item ${i + 1} (${part.name}): Insufficient stock. Available: ${part.stock}, Requested: ${item.quantity}` },
          { status: 400 }
        );
      }
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

    // Atomic transaction: create sale (as draft — no stock deduction yet)
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Re-validate stock inside transaction (prevents race conditions)
      for (let i = 0; i < saleItems.length; i++) {
        const part = await tx.part.findUnique({ where: { id: saleItems[i].partId } });
        if (!part) throw new Error(`Item ${i + 1}: Part not found`);
        if (part.stock < saleItems[i].quantity) {
          throw new Error(`Item ${i + 1} (${part.name}): Insufficient stock. Available: ${part.stock}, Requested: ${saleItems[i].quantity}`);
        }
      }

      // 2. Create sale record with items (draft status — stock not deducted)
      const newSale = await tx.sale.create({
        data: {
          jobCardId: jobCardId || null,
          customer: customerName,
          date: new Date(),
          laborCost: labor,
          subtotal,
          discount: disc,
          total,
          paymentType: paymentType || "cash",
          status: "draft",
          items: { create: saleItems },
          labourItems: saleLabourItems.length > 0 ? { create: saleLabourItems } : undefined,
        },
        include: { items: { include: { part: true } }, labourItems: { include: { labour: true } }, jobCard: true },
      });

      return newSale;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("POST /api/sales error:", error);
    const msg = error instanceof Error ? error.message : "Failed to create sale";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
