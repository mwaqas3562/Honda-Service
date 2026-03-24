import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

/**
 * GET /api/reports/transactions?from=&to=&type=&search=&paymentType=
 *
 * Unified transaction list: sales, services, purchases in one stream.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const typeFilter = searchParams.get("type") || "all"; // all|sale|service|purchase
    const paymentFilter = searchParams.get("paymentType") || "all";
    const search = searchParams.get("search")?.trim();

    const now = new Date();
    const from = fromParam
      ? new Date(fromParam + "T00:00:00Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const to = toParam
      ? new Date(toParam + "T23:59:59Z")
      : now;

    interface Transaction {
      id: number;
      type: "sale" | "service" | "purchase";
      date: string;
      customer: string;
      description: string;
      paymentType: string;
      itemCount: number;
      total: number;
      status: string;
      ref: string;
    }

    const transactions: Transaction[] = [];

    // ── Sales ──
    if (typeFilter === "all" || typeFilter === "sale" || typeFilter === "service") {
      const salesWhere: Record<string, unknown> = {
        createdAt: { gte: from, lte: to },
      };
      // When filtering by type, scope to the right saleType
      if (typeFilter === "sale") salesWhere.saleType = "sale";
      if (typeFilter === "service") salesWhere.saleType = "quick_service";
      if (paymentFilter !== "all") salesWhere.paymentType = paymentFilter;
      if (search) {
        salesWhere.OR = [
          { customer: { contains: search, mode: "insensitive" } },
          { jobCard: { customerName: { contains: search, mode: "insensitive" } } },
          { jobCard: { jobCardNumber: { contains: search, mode: "insensitive" } } },
        ];
      }

      const sales = await prisma.sale.findMany({
        where: salesWhere,
        include: {
          items: true,
          labourItems: true,
          jobCard: { select: { jobCardNumber: true, customerName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const s of sales) {
        const isQS = s.saleType === "quick_service";
        const prefix = isQS ? "QS" : "S";
        transactions.push({
          id: s.id,
          type: isQS ? "service" : "sale",
          date: s.createdAt.toISOString(),
          customer: s.customer || s.jobCard?.customerName || "Walk-in",
          description: s.jobCard
            ? `Job Card #${s.jobCard.jobCardNumber}`
            : isQS ? `Quick Service #${s.id}` : `Sale #${s.id}`,
          paymentType: s.paymentType || "cash",
          itemCount: s.items.length + s.labourItems.length,
          total: n(s.total),
          status: s.status,
          ref: s.jobCard?.jobCardNumber || `${prefix}-${s.id}`,
        });
      }
    }

    // ── Services ──
    if (typeFilter === "all" || typeFilter === "service") {
      const svcWhere: Record<string, unknown> = {
        createdAt: { gte: from, lte: to },
      };
      if (search) {
        svcWhere.OR = [
          { customerName: { contains: search, mode: "insensitive" } },
          { bikeRegNo: { contains: search, mode: "insensitive" } },
        ];
      }

      const services = await prisma.service.findMany({
        where: svcWhere,
        include: { items: true },
        orderBy: { createdAt: "desc" },
      });

      for (const s of services) {
        transactions.push({
          id: s.id,
          type: "service",
          date: s.createdAt.toISOString(),
          customer: s.customerName,
          description: `${s.serviceType} — ${s.bikeModel || "N/A"}`,
          paymentType: "cash",
          itemCount: s.items.length,
          total: n(s.total),
          status: s.status,
          ref: `SVC-${s.id}`,
        });
      }
    }

    // ── Purchases ──
    if (typeFilter === "all" || typeFilter === "purchase") {
      const purWhere: Record<string, unknown> = {
        createdAt: { gte: from, lte: to },
      };
      if (search) {
        purWhere.vendor = { name: { contains: search, mode: "insensitive" } };
      }

      const purchases = await prisma.purchase.findMany({
        where: purWhere,
        include: {
          items: true,
          vendor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const p of purchases) {
        transactions.push({
          id: p.id,
          type: "purchase",
          date: p.createdAt.toISOString(),
          customer: p.vendor?.name || "Unknown Vendor",
          description: `Purchase #${p.id}${p.note ? ` — ${p.note}` : ""}`,
          paymentType: "cash",
          itemCount: p.items.length,
          total: -n(p.total), // Negative for outflow
          status: p.status,
          ref: `PUR-${p.id}`,
        });
      }
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Summary
    const salesTotal = transactions
      .filter((t) => t.type === "sale")
      .reduce((s, t) => s + t.total, 0);
    const servicesTotal = transactions
      .filter((t) => t.type === "service")
      .reduce((s, t) => s + t.total, 0);
    const purchasesTotal = transactions
      .filter((t) => t.type === "purchase")
      .reduce((s, t) => s + Math.abs(t.total), 0);

    return NextResponse.json({
      transactions,
      summary: {
        salesTotal: Math.round(salesTotal * 100) / 100,
        servicesTotal: Math.round(servicesTotal * 100) / 100,
        purchasesTotal: Math.round(purchasesTotal * 100) / 100,
        netCashFlow: Math.round((salesTotal + servicesTotal - purchasesTotal) * 100) / 100,
        count: transactions.length,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/transactions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
