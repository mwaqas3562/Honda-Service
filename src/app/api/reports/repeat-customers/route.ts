import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

/**
 * GET /api/reports/repeat-customers
 *
 * Customer Repeat Analysis — groups visits by bikeNumber,
 * computes gaps, classifies frequency.
 *
 * Query params:
 *   dateFrom, dateTo   — filter visit date range
 *   minVisits           — minimum visits to include (default 2)
 *   repeatType          — frequent | monthly | occasional
 *   bike                — drill-down: return all visits for this bikeNumber
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const minVisits = Math.max(1, parseInt(searchParams.get("minVisits") || "2", 10));
    const repeatType = searchParams.get("repeatType") || "";
    const drillBike = searchParams.get("bike")?.trim();

    // ── Date filter ──
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // ── Drill-down: single bike ──
    if (drillBike) {
      // Fetch all visits for this bike from sales + job cards
      const [sales, jobCards] = await Promise.all([
        prisma.sale.findMany({
          where: {
            status: "final",
            deletedAt: null,
            OR: [
              { bikeNumber: { equals: drillBike, mode: "insensitive" } },
              { jobCard: { vehicleNumber: { equals: drillBike, mode: "insensitive" } } },
            ],
            ...dateWhere,
          },
          select: {
            id: true,
            saleType: true,
            customer: true,
            bikeNumber: true,
            phone: true,
            total: true,
            discount: true,
            paymentType: true,
            createdAt: true,
            jobCard: {
              select: {
                jobCardNumber: true,
                customerName: true,
                vehicleNumber: true,
                bikeModel: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.jobCard.findMany({
          where: {
            vehicleNumber: { equals: drillBike, mode: "insensitive" },
            deletedAt: null,
            ...dateWhere,
          },
          select: {
            id: true,
            jobCardNumber: true,
            customerName: true,
            vehicleNumber: true,
            bikeModel: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      // Merge into unified visits sorted by date
      interface Visit {
        id: number;
        type: string;
        ref: string;
        date: string;
        customer: string;
        amount: number;
        paymentType: string;
        gapDays: number | null;
      }

      const visitMap = new Map<string, Visit>();

      for (const s of sales) {
        visitMap.set(`sale-${s.id}`, {
          id: s.id,
          type: s.saleType === "quick_service" ? "service" : "sale",
          ref: s.jobCard ? `JC-${s.jobCard.jobCardNumber}` : `S-${s.id}`,
          date: s.createdAt.toISOString(),
          customer: s.customer || s.jobCard?.customerName || "Walk-in",
          amount: n(s.total),
          paymentType: s.paymentType,
          gapDays: null,
        });
      }

      // Add job cards that don't already have a linked sale
      const saleJCNumbers = new Set(
        sales.filter((s) => s.jobCard).map((s) => s.jobCard!.jobCardNumber)
      );
      for (const jc of jobCards) {
        if (!saleJCNumbers.has(jc.jobCardNumber)) {
          visitMap.set(`jc-${jc.id}`, {
            id: jc.id,
            type: "jobcard",
            ref: `JC-${jc.jobCardNumber}`,
            date: jc.createdAt.toISOString(),
            customer: jc.customerName,
            amount: 0,
            paymentType: "",
            gapDays: null,
          });
        }
      }

      const visits = Array.from(visitMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate gaps
      for (let i = 1; i < visits.length; i++) {
        const prev = new Date(visits[i - 1].date).getTime();
        const curr = new Date(visits[i].date).getTime();
        visits[i].gapDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      }

      return NextResponse.json({ visits });
    }

    // ── Aggregated list ──
    // Fetch all finalized sales that have a bikeNumber (direct or via jobCard)
    const sales = await prisma.sale.findMany({
      where: {
        status: "final",
        deletedAt: null,
        OR: [
          { bikeNumber: { not: "" } },
          { jobCard: { vehicleNumber: { not: "" } } },
        ],
        ...dateWhere,
      },
      select: {
        id: true,
        customer: true,
        bikeNumber: true,
        phone: true,
        total: true,
        createdAt: true,
        jobCard: {
          select: {
            customerName: true,
            customerPhone: true,
            vehicleNumber: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Also include job cards (some may not have a sale yet)
    const jobCards = await prisma.jobCard.findMany({
      where: {
        vehicleNumber: { not: "" },
        deletedAt: null,
        ...dateWhere,
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        vehicleNumber: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by bikeNumber (normalized lowercase)
    interface BikeVisit {
      date: Date;
      amount: number;
    }

    const bikeMap = new Map<
      string,
      {
        bikeNumber: string;
        customerName: string;
        phone: string | null;
        visits: BikeVisit[];
      }
    >();

    const getOrCreate = (bike: string, customer: string, phone: string | null) => {
      const key = bike.toLowerCase().trim();
      if (!key) return null;
      let entry = bikeMap.get(key);
      if (!entry) {
        entry = {
          bikeNumber: bike.trim(),
          customerName: customer,
          phone,
          visits: [],
        };
        bikeMap.set(key, entry);
      }
      // Update customer name if we have a better one
      if (customer && customer !== "Walk-in" && entry.customerName === "Walk-in") {
        entry.customerName = customer;
      }
      if (!entry.phone && phone) entry.phone = phone;
      return entry;
    }

    for (const s of sales) {
      const bike = s.bikeNumber || s.jobCard?.vehicleNumber;
      if (!bike) continue;
      const customer = s.customer || s.jobCard?.customerName || "Walk-in";
      const phone = s.phone || s.jobCard?.customerPhone || null;
      const entry = getOrCreate(bike, customer, phone);
      if (entry) {
        entry.visits.push({ date: s.createdAt, amount: n(s.total) });
      }
    }

    // Add job card visits (deduplicate by date — same day as a sale counts as one visit)
    for (const jc of jobCards) {
      if (!jc.vehicleNumber) continue;
      const entry = getOrCreate(jc.vehicleNumber, jc.customerName, jc.customerPhone);
      if (entry) {
        const jcDay = jc.createdAt.toISOString().split("T")[0];
        const alreadyHasVisitThatDay = entry.visits.some(
          (v) => v.date.toISOString().split("T")[0] === jcDay
        );
        if (!alreadyHasVisitThatDay) {
          entry.visits.push({ date: jc.createdAt, amount: 0 });
        }
      }
    }

    // Build result
    interface RepeatCustomer {
      bikeNumber: string;
      customerName: string;
      phone: string | null;
      totalVisits: number;
      lastVisitDate: string;
      avgGapDays: number;
      repeatType: "frequent" | "monthly" | "occasional";
      totalSpent: number;
    }

    const classify = (avgGap: number): "frequent" | "monthly" | "occasional" => {
      if (avgGap <= 30) return "frequent";
      if (avgGap <= 60) return "monthly";
      return "occasional";
    }

    const results: RepeatCustomer[] = [];

    for (const entry of Array.from(bikeMap.values())) {
      // Sort visits by date
      entry.visits.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (entry.visits.length < minVisits) continue;

      // Calculate average gap
      let totalGap = 0;
      for (let i = 1; i < entry.visits.length; i++) {
        const gap = entry.visits[i].date.getTime() - entry.visits[i - 1].date.getTime();
        totalGap += gap;
      }
      const avgGapMs = totalGap / (entry.visits.length - 1);
      const avgGapDays = Math.round(avgGapMs / (1000 * 60 * 60 * 24));

      const rt = classify(avgGapDays);

      if (repeatType && rt !== repeatType) continue;

      results.push({
        bikeNumber: entry.bikeNumber,
        customerName: entry.customerName,
        phone: entry.phone,
        totalVisits: entry.visits.length,
        lastVisitDate: entry.visits[entry.visits.length - 1].date.toISOString(),
        avgGapDays,
        repeatType: rt,
        totalSpent: Math.round(entry.visits.reduce((s, v) => s + v.amount, 0)),
      });
    }

    // Sort by total visits descending
    results.sort((a, b) => b.totalVisits - a.totalVisits);

    // Summary stats
    const frequent = results.filter((r) => r.repeatType === "frequent").length;
    const monthly = results.filter((r) => r.repeatType === "monthly").length;
    const occasional = results.filter((r) => r.repeatType === "occasional").length;

    return NextResponse.json({
      customers: results,
      summary: {
        total: results.length,
        frequent,
        monthly,
        occasional,
        totalRevenue: results.reduce((s, r) => s + r.totalSpent, 0),
      },
    });
  } catch (error) {
    console.error("GET /api/reports/repeat-customers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch repeat analysis" },
      { status: 500 }
    );
  }
}
