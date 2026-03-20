import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

/**
 * Calculate and upsert bonus logs for all staff assigned to a job card.
 * Safe to call multiple times (idempotent via upsert on staffId+jobCardId).
 *
 * Only awards bonuses when:
 * 1. Job card status is "completed"
 * 2. The staff member has an active bonus config
 * 3. The job card total (laborCost + finalized sales) >= minJobcardAmount
 *
 * Can be called with a Prisma transaction client or the default client.
 */
export async function calculateJobCardBonuses(
  jobCardId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any,
) {
  const db = tx || prisma;

  const jobCard = await db.jobCard.findUnique({
    where: { id: jobCardId },
    include: {
      sales: { where: { status: "final" }, select: { total: true } },
      staffAssignments: { select: { staffId: true } },
    },
  });

  if (!jobCard || jobCard.status !== "completed") return;

  const salesToTotal = jobCard.sales.reduce(
    (sum: number, s: { total: unknown }) => sum + n(s.total),
    0,
  );
  const jobCardTotal = n(jobCard.laborCost) + salesToTotal;

  for (const assignment of jobCard.staffAssignments) {
    const config = await db.staffBonusConfig.findUnique({
      where: { staffId: assignment.staffId },
    });

    if (config && config.active && jobCardTotal >= n(config.minJobcardAmount)) {
      const amountAboveMin = jobCardTotal - n(config.minJobcardAmount);
      const bonusAmount =
        config.bonusType === "percentage"
          ? Math.round(((amountAboveMin * n(config.bonusValue)) / 100) * 100) / 100
          : n(config.bonusValue);

      await db.staffBonusLog.upsert({
        where: {
          staffId_jobCardId: {
            staffId: assignment.staffId,
            jobCardId,
          },
        },
        create: {
          staffId: assignment.staffId,
          jobCardId,
          jobCardAmount: jobCardTotal,
          bonusAmount,
          bonusType: config.bonusType,
          bonusValue: config.bonusValue,
        },
        update: {
          jobCardAmount: jobCardTotal,
          bonusAmount,
          bonusType: config.bonusType,
          bonusValue: config.bonusValue,
        },
      });
    }
  }
}

/**
 * Recalculate bonuses for ALL completed job cards.
 * Useful for backfilling after bonus configs are created/updated.
 */
export async function recalculateAllBonuses() {
  const completedCards = await prisma.jobCard.findMany({
    where: { status: "completed" },
    select: { id: true },
  });

  let processed = 0;
  for (const jc of completedCards) {
    await calculateJobCardBonuses(jc.id);
    processed++;
  }

  return { processed };
}
