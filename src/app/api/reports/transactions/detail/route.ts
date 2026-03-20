import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reports/transactions/detail?type=sale|service|purchase&id=N
 *
 * Returns full detail for a single transaction — used by the invoice drill-down.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const idParam = searchParams.get("id");

    if (!type || !idParam) {
      return NextResponse.json({ error: "type and id are required" }, { status: 400 });
    }

    const id = Number(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "id must be a number" }, { status: 400 });
    }

    if (type === "sale") {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          items: { include: { part: { select: { name: true, partNumber: true } } } },
          labourItems: { include: { labour: { select: { name: true } } } },
          jobCard: { select: { jobCardNumber: true, customerName: true, bikeModel: true, vehicleNumber: true } },
        },
      });

      if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

      return NextResponse.json({
        type: "sale" as const,
        id: sale.id,
        ref: sale.jobCard?.jobCardNumber || `S-${sale.id}`,
        date: sale.createdAt.toISOString(),
        customer: sale.customer || sale.jobCard?.customerName || "Walk-in",
        bike: sale.jobCard ? `${sale.jobCard.bikeModel || ""}${sale.jobCard.vehicleNumber ? ` (${sale.jobCard.vehicleNumber})` : ""}`.trim() || null : null,
        paymentType: sale.paymentType || "cash",
        status: sale.status,
        subtotal: sale.subtotal,
        laborCost: sale.laborCost,
        discount: sale.discount,
        total: sale.total,
        items: sale.items.map((i) => ({
          name: i.part.name,
          partNumber: i.part.partNumber,
          qty: i.quantity,
          price: i.unitPrice,
          total: i.total,
        })),
        labourItems: sale.labourItems.map((l) => ({
          name: l.labour.name,
          qty: l.quantity,
          price: l.unitPrice,
          total: l.total,
        })),
      });
    }

    if (type === "service") {
      const svc = await prisma.service.findUnique({
        where: { id },
        include: {
          items: { include: { part: { select: { name: true, partNumber: true } } } },
        },
      });

      if (!svc) return NextResponse.json({ error: "Service not found" }, { status: 404 });

      return NextResponse.json({
        type: "service",
        id: svc.id,
        ref: `SVC-${svc.id}`,
        date: svc.createdAt.toISOString(),
        customer: svc.customerName,
        phone: svc.customerPhone,
        bike: `${svc.bikeModel}${svc.bikeRegNo ? ` (${svc.bikeRegNo})` : ""}`,
        serviceType: svc.serviceType,
        paymentType: "cash",
        status: svc.status,
        laborCost: svc.laborCost,
        total: svc.total,
        note: svc.note,
        items: svc.items.map((i) => ({
          name: i.part.name,
          partNumber: i.part.partNumber,
          qty: i.quantity,
          price: i.unitPrice,
          total: i.total,
        })),
        labourItems: [],
      });
    }

    if (type === "purchase") {
      const pur = await prisma.purchase.findUnique({
        where: { id },
        include: {
          items: { include: { part: { select: { name: true, partNumber: true } } } },
          vendor: { select: { name: true } },
        },
      });

      if (!pur) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

      return NextResponse.json({
        type: "purchase",
        id: pur.id,
        ref: `PUR-${pur.id}`,
        date: pur.createdAt.toISOString(),
        customer: pur.vendor.name,
        paymentType: "cash",
        status: pur.status,
        total: pur.total,
        note: pur.note,
        items: pur.items.map((i) => ({
          name: i.part.name,
          partNumber: i.part.partNumber,
          qty: i.quantity,
          price: i.unitPrice,
          total: i.total,
        })),
        labourItems: [],
      });
    }

    return NextResponse.json({ error: "Invalid type — use sale, service, or purchase" }, { status: 400 });
  } catch (error) {
    console.error("GET /api/reports/transactions/detail error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch detail" },
      { status: 500 }
    );
  }
}
