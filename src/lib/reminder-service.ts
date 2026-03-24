import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";
import { CustomerProfile } from "@/lib/reminder-engine";

/**
 * Build customer profiles from Sale + JobCard + Service data,
 * grouped by phone number. Attaches reminder history from ReminderLog.
 */
export async function fetchCustomerProfiles(): Promise<CustomerProfile[]> {
  // Fetch finalized sales with phone numbers
  const sales = await prisma.sale.findMany({
    where: {
      status: "final",
      deletedAt: null,
      phone: { not: "" },
    },
    select: {
      customer: true,
      bikeNumber: true,
      phone: true,
      total: true,
      saleType: true,
      createdAt: true,
      jobCard: {
        select: {
          customerName: true,
          customerPhone: true,
          vehicleNumber: true,
          bikeModel: true,
        },
      },
      labourItems: {
        select: {
          labour: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch services with phone numbers
  const services = await prisma.service.findMany({
    where: {
      deletedAt: null,
      customerPhone: { not: "" },
    },
    select: {
      customerName: true,
      customerPhone: true,
      bikeModel: true,
      bikeRegNo: true,
      serviceType: true,
      total: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Build profile map keyed by phone
  const profileMap = new Map<
    string,
    {
      customerName: string;
      bikeNumber: string;
      bikeModel: string;
      visits: { date: Date; serviceType?: string }[];
      totalSpend: number;
    }
  >();

  // Process sales
  for (const s of sales) {
    const phone = (s.phone || s.jobCard?.customerPhone || "").trim();
    if (!phone) continue;

    const existing = profileMap.get(phone);
    const name = s.customer || s.jobCard?.customerName || "Customer";
    const bike = s.bikeNumber || s.jobCard?.vehicleNumber || "";
    const model = s.jobCard?.bikeModel || "";

    // Infer service type from sale type + labour items
    let serviceType: string | undefined;
    if (s.saleType === "quick_service") {
      // Try to infer from labour items
      const labourNames = s.labourItems.map((l) => l.labour.name.toLowerCase());
      if (labourNames.some((n) => n.includes("engine") && n.includes("tun"))) {
        serviceType = "engine_tune_up";
      } else if (labourNames.some((n) => n.includes("oil"))) {
        serviceType = "oil_change";
      }
    }

    if (existing) {
      existing.visits.push({ date: s.createdAt, serviceType });
      existing.totalSpend += n(s.total);
      // Keep the most recent name/bike
      if (!existing.customerName || existing.customerName === "Customer") {
        existing.customerName = name;
      }
      if (!existing.bikeNumber) existing.bikeNumber = bike;
      if (!existing.bikeModel) existing.bikeModel = model;
    } else {
      profileMap.set(phone, {
        customerName: name,
        bikeNumber: bike,
        bikeModel: model,
        visits: [{ date: s.createdAt, serviceType }],
        totalSpend: n(s.total),
      });
    }
  }

  // Process services
  for (const svc of services) {
    const phone = (svc.customerPhone || "").trim();
    if (!phone) continue;

    const existing = profileMap.get(phone);
    const name = svc.customerName || "Customer";
    const bike = svc.bikeRegNo || "";
    const model = svc.bikeModel || "";

    if (existing) {
      existing.visits.push({ date: svc.createdAt, serviceType: svc.serviceType });
      existing.totalSpend += n(svc.total);
      if (!existing.customerName || existing.customerName === "Customer") {
        existing.customerName = name;
      }
      if (!existing.bikeNumber) existing.bikeNumber = bike;
      if (!existing.bikeModel) existing.bikeModel = model;
    } else {
      profileMap.set(phone, {
        customerName: name,
        bikeNumber: bike,
        bikeModel: model,
        visits: [{ date: svc.createdAt, serviceType: svc.serviceType }],
        totalSpend: n(svc.total),
      });
    }
  }

  // Fetch reminder history for all phones
  const phones = Array.from(profileMap.keys());
  const reminderLogs = phones.length > 0
    ? await prisma.reminderLog.findMany({
        where: { customerPhone: { in: phones } },
        select: {
          customerPhone: true,
          status: true,
          sentAt: true,
        },
        orderBy: { sentAt: "desc" },
      })
    : [];

  // Group reminders by phone
  const reminderMap = new Map<string, { status: string; sentAt: Date }[]>();
  for (const r of reminderLogs) {
    const list = reminderMap.get(r.customerPhone) || [];
    list.push({ status: r.status, sentAt: r.sentAt });
    reminderMap.set(r.customerPhone, list);
  }

  // Build final profiles
  const profiles: CustomerProfile[] = [];
  for (const [phone, data] of Array.from(profileMap.entries())) {
    // Sort visits newest first
    data.visits.sort((a, b) => b.date.getTime() - a.date.getTime());
    const lastVisit = data.visits[0];
    if (!lastVisit) continue;

    const reminders = reminderMap.get(phone) || [];
    const lastReminderSentDate = reminders.length > 0 ? reminders[0].sentAt : null;

    profiles.push({
      customerPhone: phone,
      customerName: data.customerName,
      bikeNumber: data.bikeNumber,
      bikeModel: data.bikeModel,
      lastVisitDate: lastVisit.date,
      lastServiceType: lastVisit.serviceType || "",
      visitHistory: data.visits.slice(0, 3),
      totalSpend: data.totalSpend,
      lastReminderSentDate,
      reminderHistory: reminders.slice(0, 3),
    });
  }

  return profiles;
}
