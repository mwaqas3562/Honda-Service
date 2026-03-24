import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

/**
 * GET /api/reports/customers?search=&name=
 *
 * Customer report: aggregated list + drill-down by customer name.
 * ?name=CustomerName → returns full transaction history for that customer.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const customerName = searchParams.get("name")?.trim();
    const from = searchParams.get("from")?.trim();
    const to = searchParams.get("to")?.trim();

    // Build an optional createdAt date range filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(`${from}T00:00:00`);
    if (to) dateFilter.lte = new Date(`${to}T23:59:59.999`);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ── Single customer drill-down ──
    if (customerName) {
      const [sales, services, jobCards] = await Promise.all([
        prisma.sale.findMany({
          where: {
            status: "final",
            ...(hasDateFilter && { createdAt: dateFilter }),
            OR: [
              { customer: { equals: customerName, mode: "insensitive" } },
              { jobCard: { customerName: { equals: customerName, mode: "insensitive" } } },
            ],
          },
          include: {
            items: { include: { part: { select: { name: true, partNumber: true } } } },
            labourItems: { include: { labour: { select: { name: true } } } },
            jobCard: { select: { jobCardNumber: true, bikeModel: true, vehicleNumber: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.service.findMany({
          where: {
            customerName: { equals: customerName, mode: "insensitive" },
            ...(hasDateFilter && { createdAt: dateFilter }),
          },
          include: {
            items: { include: { part: { select: { name: true, partNumber: true } } } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.jobCard.findMany({
          where: {
            customerName: { equals: customerName, mode: "insensitive" },
            ...(hasDateFilter && { createdAt: dateFilter }),
          },
          select: {
            id: true,
            jobCardNumber: true,
            bikeModel: true,
            vehicleNumber: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Build timeline
      interface TimelineEntry {
        id: number;
        type: "sale" | "service" | "jobcard";
        date: string;
        description: string;
        total: number;
        status: string;
        items: { name: string; qty: number; price: number; total: number }[];
        ref: string;
        bike: string;
        vehicle: string;
      }

      const timeline: TimelineEntry[] = [];

      for (const s of sales) {
        const items = [
          ...s.items.map((i) => ({
            name: i.part.name,
            qty: i.quantity,
            price: n(i.unitPrice),
            total: n(i.total),
          })),
          ...s.labourItems.map((l) => ({
            name: `Labour: ${l.labour.name}`,
            qty: l.quantity,
            price: n(l.unitPrice),
            total: n(l.total),
          })),
        ];
        timeline.push({
          id: s.id,
          type: "sale",
          date: s.createdAt.toISOString(),
          description: s.jobCard
            ? `Job Card #${s.jobCard.jobCardNumber}`
            : `Sale #${s.id}`,
          total: n(s.total),
          status: s.status,
          items,
          ref: s.jobCard?.jobCardNumber || `S-${s.id}`,
          bike: s.jobCard?.bikeModel || "",
          vehicle: s.jobCard?.vehicleNumber || "",
        });
      }

      for (const s of services) {
        const items = s.items.map((i) => ({
          name: i.part.name,
          qty: i.quantity,
          price: n(i.unitPrice),
          total: n(i.total),
        }));
        timeline.push({
          id: s.id,
          type: "service",
          date: s.createdAt.toISOString(),
          description: `${s.serviceType} — ${s.bikeModel || "N/A"}`,
          total: n(s.total),
          status: s.status,
          items,
          ref: `SVC-${s.id}`,
          bike: s.bikeModel || "",
          vehicle: s.bikeRegNo || "",
        });
      }

      for (const jc of jobCards) {
        // Only add job cards not already represented via sales
        const hasSale = sales.some(
          (s) => s.jobCard?.jobCardNumber === jc.jobCardNumber
        );
        if (!hasSale) {
          timeline.push({
            id: jc.id,
            type: "jobcard",
            date: jc.createdAt.toISOString(),
            description: `Job Card #${jc.jobCardNumber}`,
            total: 0,
            status: jc.status,
            items: [],
            ref: jc.jobCardNumber,
            bike: jc.bikeModel,
            vehicle: jc.vehicleNumber || "",
          });
        }
      }

      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Collect unique bikes
      const bikes = new Set<string>();
      for (const t of timeline) {
        if (t.bike) bikes.add(t.bike);
      }

      // Summary
      const totalSpent = timeline.reduce((s, t) => s + t.total, 0);
      const salesCount = timeline.filter((t) => t.type === "sale").length;
      const servicesCount = timeline.filter((t) => t.type === "service").length;

      // Find phone from job cards or services
      let phone: string | null = null;
      const jcWithPhone = await prisma.jobCard.findFirst({
        where: { customerName: { equals: customerName, mode: "insensitive" } },
        select: { customerPhone: true },
      });
      if (jcWithPhone?.customerPhone) phone = jcWithPhone.customerPhone;
      if (!phone) {
        const svcWithPhone = await prisma.service.findFirst({
          where: { customerName: { equals: customerName, mode: "insensitive" } },
          select: { customerPhone: true },
        });
        if (svcWithPhone?.customerPhone) phone = svcWithPhone.customerPhone;
      }

      return NextResponse.json({
        customer: {
          name: customerName,
          phone,
          bikes: Array.from(bikes),
          totalSpent: Math.round(totalSpent * 100) / 100,
          salesCount,
          servicesCount,
          totalVisits: salesCount + servicesCount,
        },
        timeline,
      });
    }

    // ── Customer list (aggregated) ──
    const [sales, services] = await Promise.all([
      prisma.sale.findMany({
        where: { status: "final", ...(hasDateFilter && { createdAt: dateFilter }) },
        select: {
          customer: true,
          total: true,
          paymentType: true,
          createdAt: true,
          jobCard: { select: { customerName: true, customerPhone: true, bikeModel: true, vehicleNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.service.findMany({
        where: { ...(hasDateFilter && { createdAt: dateFilter }) },
        select: { customerName: true, customerPhone: true, bikeModel: true, total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const map = new Map<
      string,
      {
        name: string;
        phone: string | null;
        salesCount: number;
        salesTotal: number;
        servicesCount: number;
        servicesTotal: number;
        bikes: Set<string>;
        vehicles: Set<string>;
        lastVisit: Date;
        creditCount: number;
      }
    >();

    for (const s of sales) {
      const cname = s.customer || s.jobCard?.customerName || "Walk-in";
      const key = cname.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.salesCount++;
        existing.salesTotal += n(s.total);
        if (!existing.phone && s.jobCard?.customerPhone) existing.phone = s.jobCard.customerPhone;
        if (s.jobCard?.bikeModel) existing.bikes.add(s.jobCard.bikeModel);
        if (s.jobCard?.vehicleNumber) existing.vehicles.add(s.jobCard.vehicleNumber);
        if (new Date(s.createdAt) > existing.lastVisit) existing.lastVisit = new Date(s.createdAt);
        if (s.paymentType === "credit") existing.creditCount++;
      } else {
        map.set(key, {
          name: cname,
          phone: s.jobCard?.customerPhone || null,
          salesCount: 1,
          salesTotal: n(s.total),
          servicesCount: 0,
          servicesTotal: 0,
          bikes: new Set(s.jobCard?.bikeModel ? [s.jobCard.bikeModel] : []),
          vehicles: new Set(s.jobCard?.vehicleNumber ? [s.jobCard.vehicleNumber] : []),
          lastVisit: new Date(s.createdAt),
          creditCount: s.paymentType === "credit" ? 1 : 0,
        });
      }
    }

    for (const s of services) {
      const key = s.customerName.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.servicesCount++;
        existing.servicesTotal += n(s.total);
        if (s.bikeModel) existing.bikes.add(s.bikeModel);
        if (!existing.phone && s.customerPhone) existing.phone = s.customerPhone;
        if (new Date(s.createdAt) > existing.lastVisit) existing.lastVisit = new Date(s.createdAt);
      } else {
        map.set(key, {
          name: s.customerName,
          phone: s.customerPhone,
          salesCount: 0,
          salesTotal: 0,
          servicesCount: 1,
          servicesTotal: n(s.total),
          bikes: new Set(s.bikeModel ? [s.bikeModel] : []),
          vehicles: new Set<string>(),
          lastVisit: new Date(s.createdAt),
          creditCount: 0,
        });
      }
    }

    let customers = Array.from(map.values()).map((c) => ({
      name: c.name,
      phone: c.phone,
      salesCount: c.salesCount,
      salesTotal: Math.round(c.salesTotal),
      servicesCount: c.servicesCount,
      servicesTotal: Math.round(c.servicesTotal),
      totalSpent: Math.round(c.salesTotal + c.servicesTotal),
      totalVisits: c.salesCount + c.servicesCount,
      bikes: Array.from(c.bikes),
      vehicles: Array.from(c.vehicles),
      lastVisit: c.lastVisit.toISOString(),
      creditCount: c.creditCount,
    }));

    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          c.bikes.some((b) => b.toLowerCase().includes(q)) ||
          c.vehicles.some((v) => v.toLowerCase().includes(q))
      );
    }

    customers.sort((a, b) => b.totalSpent - a.totalSpent);

    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);

    return NextResponse.json({
      customers,
      summary: {
        totalCustomers: customers.length,
        totalRevenue,
        avgSpend: customers.length > 0 ? Math.round(totalRevenue / customers.length) : 0,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/customers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch customer report" },
      { status: 500 }
    );
  }
}
