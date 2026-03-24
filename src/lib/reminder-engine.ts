import { ReminderType } from "@/generated/prisma/client";

// ─── Types ───────────────────────────────────────

export interface CustomerProfile {
  customerPhone: string;
  customerName: string;
  bikeNumber: string;
  bikeModel: string;
  lastVisitDate: Date;
  lastServiceType: string; // matches ServiceType enum values
  visitHistory: { date: Date; serviceType?: string }[]; // last 3 visits
  totalSpend: number;
  lastReminderSentDate: Date | null;
  reminderHistory: { status: string; sentAt: Date }[]; // last 3 reminders
}

export interface ReminderDecision {
  customerPhone: string;
  customerName: string;
  bikeNumber: string;
  bikeModel: string;
  messageType: ReminderType;
  priority: number;
}

// ─── Config defaults ─────────────────────────────

export interface ReminderEngineConfig {
  cooldownDays: number;       // min days between reminders (default 7)
  maxIgnored: number;         // stop after N ignored reminders (default 3)
  engineTuningDays: number;   // days since last engine tuning visit (default 30)
  oilChangeDays: number;      // days since last oil change visit (default 20)
  inactiveDays: number;       // days for comeback reminder (default 60)
  missedVisitBuffer: number;  // days past expected date (default 5)
  highValueThreshold: number; // spend threshold for priority boost (default 10000)
  priorityBoost: number;      // priority added for high-value customers (default 2)
}

const DEFAULT_CONFIG: ReminderEngineConfig = {
  cooldownDays: 7,
  maxIgnored: 3,
  engineTuningDays: 30,
  oilChangeDays: 20,
  inactiveDays: 60,
  missedVisitBuffer: 5,
  highValueThreshold: 10000,
  priorityBoost: 2,
};

// ─── Helpers ─────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function avgGapDays(visits: { date: Date }[]): number | null {
  if (visits.length < 2) return null;
  const sorted = [...visits].sort((a, b) => a.date.getTime() - b.date.getTime());
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += daysBetween(sorted[i - 1].date, sorted[i].date);
  }
  return totalGap / (sorted.length - 1);
}

// ─── Rules Engine ────────────────────────────────

export function evaluateCustomer(
  customer: CustomerProfile,
  now: Date,
  config: ReminderEngineConfig = DEFAULT_CONFIG
): ReminderDecision | null {
  const {
    cooldownDays,
    maxIgnored,
    engineTuningDays,
    oilChangeDays,
    inactiveDays,
    missedVisitBuffer,
    highValueThreshold,
    priorityBoost,
  } = config;

  // Rule 0a: Global cooldown — skip if reminder sent < cooldownDays ago
  if (customer.lastReminderSentDate) {
    const daysSinceReminder = daysBetween(customer.lastReminderSentDate, now);
    if (daysSinceReminder < cooldownDays) return null;
  }

  // Rule 0b: Anti-spam — skip if last N reminders were all ignored
  if (customer.reminderHistory.length >= maxIgnored) {
    const lastN = customer.reminderHistory.slice(0, maxIgnored);
    if (lastN.every((r) => r.status === "ignored")) return null;
  }

  const daysSinceVisit = daysBetween(customer.lastVisitDate, now);

  // Helper: check no reminder of a specific type in last N days
  const noRecentReminder = (days: number): boolean => {
    if (!customer.lastReminderSentDate) return true;
    return daysBetween(customer.lastReminderSentDate, now) >= days;
  };

  let messageType: ReminderType | null = null;
  let basePriority = 0;

  // Rule 1: Engine Tuning
  if (
    customer.lastServiceType === "engine_tune_up" &&
    daysSinceVisit >= engineTuningDays &&
    noRecentReminder(engineTuningDays)
  ) {
    messageType = "engine_tuning";
    basePriority = 2;
  }

  // Rule 2: Oil Change
  if (
    !messageType &&
    customer.lastServiceType === "oil_change" &&
    daysSinceVisit >= oilChangeDays &&
    noRecentReminder(oilChangeDays)
  ) {
    messageType = "oil_change";
    basePriority = 2;
  }

  // Rule 3: Missed Visit (monthly customer)
  if (!messageType && customer.visitHistory.length >= 3) {
    const avg = avgGapDays(customer.visitHistory);
    if (avg !== null && avg >= 25 && avg <= 35) {
      // Monthly customer — check if missed
      const sorted = [...customer.visitHistory].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );
      const expectedDate = new Date(sorted[0].date);
      expectedDate.setDate(expectedDate.getDate() + Math.round(avg));

      const daysPastExpected = daysBetween(expectedDate, now);
      if (now > expectedDate && daysPastExpected >= missedVisitBuffer) {
        messageType = "missed_visit";
        basePriority = 3;
      }
    }
  }

  // Rule 4: Inactive / Comeback
  if (
    !messageType &&
    daysSinceVisit >= inactiveDays &&
    noRecentReminder(inactiveDays)
  ) {
    messageType = "comeback";
    basePriority = 1;
  }

  if (!messageType) return null;

  // Value boost
  let priority = basePriority;
  if (customer.totalSpend > highValueThreshold) {
    priority += priorityBoost;
  }

  return {
    customerPhone: customer.customerPhone,
    customerName: customer.customerName,
    bikeNumber: customer.bikeNumber,
    bikeModel: customer.bikeModel,
    messageType,
    priority,
  };
}

/**
 * Evaluate a batch of customers and return sorted decisions.
 * Deduplicates by phone (first match wins per phone number).
 */
export function evaluateAll(
  customers: CustomerProfile[],
  now: Date,
  config?: ReminderEngineConfig
): ReminderDecision[] {
  const seen = new Set<string>();
  const decisions: ReminderDecision[] = [];

  for (const customer of customers) {
    // Max 1 message per phone per cycle
    if (seen.has(customer.customerPhone)) continue;

    const decision = evaluateCustomer(customer, now, config);
    if (decision) {
      seen.add(customer.customerPhone);
      decisions.push(decision);
    }
  }

  // Sort by priority descending (highest first)
  decisions.sort((a, b) => b.priority - a.priority);
  return decisions;
}
