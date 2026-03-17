import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/customers — aggregate customers from sales, services, and job cards
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const [sales, services, jobCards] = await Promise.all([
      prisma.sale.findMany({
        select: {
          customer: true,
          total: true,
          createdAt: true,
          jobCard: {
            select: {
              customerName: true,
              customerPhone: true,
              bikeModel: true,
              vehicleNumber: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.service.findMany({
        select: { customerName: true, customerPhone: true, bikeModel: true, total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobCard.findMany({
        select: {
          customerName: true,
          customerPhone: true,
          bikeModel: true,
          vehicleNumber: true,
        },
      }),
    ]);

    // Group by customer name (case-insensitive)
    const map = new Map<string, {
      name: string;
      phone: string | null;
      salesCount: number;
      salesTotal: number;
      servicesCount: number;
      servicesTotal: number;
      bikes: Set<string>;
      vehicles: Set<string>;
      lastVisit: Date;
    }>();

    for (const s of sales) {
      const cname = s.customer || s.jobCard?.customerName || "Walk-in";
      const key = cname.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.salesCount++;
        existing.salesTotal += s.total;
        if (!existing.phone && s.jobCard?.customerPhone) existing.phone = s.jobCard.customerPhone;
        if (s.jobCard?.bikeModel) existing.bikes.add(s.jobCard.bikeModel);
        if (s.jobCard?.vehicleNumber) existing.vehicles.add(s.jobCard.vehicleNumber);
        if (new Date(s.createdAt) > existing.lastVisit) existing.lastVisit = new Date(s.createdAt);
      } else {
        map.set(key, {
          name: cname,
          phone: s.jobCard?.customerPhone || null,
          salesCount: 1,
          salesTotal: s.total,
          servicesCount: 0,
          servicesTotal: 0,
          bikes: new Set(s.jobCard?.bikeModel ? [s.jobCard.bikeModel] : []),
          vehicles: new Set(s.jobCard?.vehicleNumber ? [s.jobCard.vehicleNumber] : []),
          lastVisit: new Date(s.createdAt),
        });
      }
    }

    for (const s of services) {
      const key = s.customerName.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.servicesCount++;
        existing.servicesTotal += s.total;
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
          servicesTotal: s.total,
          bikes: new Set(s.bikeModel ? [s.bikeModel] : []),
          vehicles: new Set(),
          lastVisit: new Date(s.createdAt),
        });
      }
    }

    // Also pull from job cards that may not have sales yet
    for (const jc of jobCards) {
      const key = jc.customerName.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        if (!existing.phone && jc.customerPhone) existing.phone = jc.customerPhone;
        if (jc.bikeModel) existing.bikes.add(jc.bikeModel);
        if (jc.vehicleNumber) existing.vehicles.add(jc.vehicleNumber);
      }
    }

    let customers = Array.from(map.values()).map((c) => ({
      name: c.name,
      phone: c.phone,
      salesCount: c.salesCount,
      salesTotal: Math.round(c.salesTotal * 100) / 100,
      servicesCount: c.servicesCount,
      servicesTotal: Math.round(c.servicesTotal * 100) / 100,
      totalSpent: Math.round((c.salesTotal + c.servicesTotal) * 100) / 100,
      totalVisits: c.salesCount + c.servicesCount,
      bikes: Array.from(c.bikes),
      vehicles: Array.from(c.vehicles),
      lastVisit: c.lastVisit.toISOString(),
    }));

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        c.bikes.some((b) => b.toLowerCase().includes(q))
      );
    }

    // Sort by total spent descending
    customers.sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}
