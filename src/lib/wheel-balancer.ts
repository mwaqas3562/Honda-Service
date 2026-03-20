import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

const WB_LABOUR_NAME = "wheel balancing";

function isWheelBalancingLabour(name: string): boolean {
  return name.toLowerCase().includes(WB_LABOUR_NAME);
}

/**
 * Find the active wheel_balancer staff member.
 * Returns null if none exists.
 */
async function getActiveWheelBalancer() {
  return prisma.staff.findFirst({
    where: { role: "wheel_balancer", status: "active" },
  });
}

/**
 * Recalculate the bonus for a given staff + month based on config and performance.
 */
async function recalculateBonus(staffId: number, month: string) {
  const config = await prisma.wheelBalancerConfig.findUnique({ where: { staffId } });
  const perf = await prisma.wheelBalancerPerformance.findUnique({
    where: { staffId_month: { staffId, month } },
  });

  if (!perf) return;

  let bonusAmount = 0;
  if (config?.active && perf.serviceCount >= config.bonusThreshold) {
    bonusAmount =
      config.bonusType === "percentage"
        ? Math.round((n(perf.totalEarnings) * n(config.bonusValue)) / 100 * 100) / 100
        : n(config.bonusValue);
  }

  await prisma.wheelBalancerPerformance.update({
    where: { staffId_month: { staffId, month } },
    data: { bonusAmount },
  });
}

/**
 * Adjust the monthly performance aggregate by delta values.
 */
async function adjustPerformance(staffId: number, month: string, countDelta: number, amountDelta: number) {
  const existing = await prisma.wheelBalancerPerformance.findUnique({
    where: { staffId_month: { staffId, month } },
  });

  if (existing) {
    await prisma.wheelBalancerPerformance.update({
      where: { staffId_month: { staffId, month } },
      data: {
        serviceCount: Math.max(0, existing.serviceCount + countDelta),
        totalEarnings: Math.max(0, Math.round((n(existing.totalEarnings) + amountDelta) * 100) / 100),
      },
    });
  } else if (countDelta > 0) {
    await prisma.wheelBalancerPerformance.create({
      data: {
        staffId,
        month,
        serviceCount: Math.max(0, countDelta),
        totalEarnings: Math.max(0, Math.round(amountDelta * 100) / 100),
      },
    });
  }
}

/**
 * Update wheel balancer tracking when a sale is created or updated.
 * Idempotent — safe to call multiple times for the same sale.
 */
export async function updateWheelBalancerTracking(saleId: number) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      labourItems: { include: { labour: { select: { name: true } } } },
    },
  });

  if (!sale) return;

  const wb = await getActiveWheelBalancer();
  if (!wb) return;

  // Find wheel balancing labour items in this sale
  const wbItems = sale.labourItems.filter((item) => isWheelBalancingLabour(item.labour.name));
  const wbCount = wbItems.reduce((sum, item) => sum + item.quantity, 0);
  const wbAmount = wbItems.reduce((sum, item) => sum + n(item.total), 0);

  const month = sale.date.toISOString().slice(0, 7); // "2026-03"

  // Get previous tracking for this sale (for idempotent updates)
  const prevLog = await prisma.wheelBalancerSaleLog.findUnique({ where: { saleId } });
  const prevCount = prevLog?.count ?? 0;
  const prevAmount = n(prevLog?.amount ?? 0);
  const prevMonth = prevLog?.month;

  // No wheel balancing in sale, and nothing was tracked before → nothing to do
  if (wbCount === 0 && !prevLog) return;

  // Update or create the per-sale log
  if (wbCount > 0) {
    await prisma.wheelBalancerSaleLog.upsert({
      where: { saleId },
      create: { saleId, staffId: wb.id, amount: wbAmount, count: wbCount, month },
      update: { staffId: wb.id, amount: wbAmount, count: wbCount, month },
    });
  } else if (prevLog) {
    // Wheel balancing removed from sale → delete tracking
    await prisma.wheelBalancerSaleLog.delete({ where: { saleId } });
  }

  // Handle month change (sale date changed between edits)
  if (prevLog && prevMonth && prevMonth !== month) {
    await adjustPerformance(wb.id, prevMonth, -prevCount, -prevAmount);
    await recalculateBonus(wb.id, prevMonth);
  }

  // Calculate deltas for the target month
  const sameMonth = prevMonth === month;
  const countDelta = wbCount - (sameMonth ? prevCount : 0);
  const amountDelta = wbAmount - (sameMonth ? prevAmount : 0);

  if (countDelta !== 0 || amountDelta !== 0) {
    await adjustPerformance(wb.id, month, countDelta, amountDelta);
  }

  // Recalculate bonus for the affected month
  await recalculateBonus(wb.id, month);
}

/**
 * Reverse wheel balancer tracking when a sale is deleted.
 * Accepts optional transaction client for atomic operations.
 */
export async function reverseWheelBalancerTracking(
  saleId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any,
) {
  const db = tx || prisma;
  const log = await db.wheelBalancerSaleLog.findUnique({ where: { saleId } });
  if (!log) return;

  // Adjust performance inside same client context
  const existing = await db.wheelBalancerPerformance.findUnique({
    where: { staffId_month: { staffId: log.staffId, month: log.month } },
  });
  if (existing) {
    await db.wheelBalancerPerformance.update({
      where: { staffId_month: { staffId: log.staffId, month: log.month } },
      data: {
        serviceCount: Math.max(0, existing.serviceCount - log.count),
        totalEarnings: Math.max(0, Math.round((n(existing.totalEarnings) - n(log.amount)) * 100) / 100),
      },
    });
  }

  await db.wheelBalancerSaleLog.delete({ where: { saleId } });

  // Recalculate bonus
  const config = await db.wheelBalancerConfig.findUnique({ where: { staffId: log.staffId } });
  const perf = await db.wheelBalancerPerformance.findUnique({
    where: { staffId_month: { staffId: log.staffId, month: log.month } },
  });
  if (perf) {
    let bonusAmount = 0;
    if (config?.active && perf.serviceCount >= config.bonusThreshold) {
      bonusAmount =
        config.bonusType === "percentage"
          ? Math.round((n(perf.totalEarnings) * n(config.bonusValue)) / 100 * 100) / 100
          : n(config.bonusValue);
    }
    await db.wheelBalancerPerformance.update({
      where: { staffId_month: { staffId: log.staffId, month: log.month } },
      data: { bonusAmount },
    });
  }
}
