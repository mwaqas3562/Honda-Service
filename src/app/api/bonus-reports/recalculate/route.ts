import { NextResponse } from "next/server";
import { recalculateAllBonuses } from "@/lib/bonus";

/**
 * POST /api/bonus-reports/recalculate
 * Recalculates bonuses for all completed job cards.
 * Useful after setting up or updating bonus configs.
 */
export async function POST() {
  try {
    const result = await recalculateAllBonuses();
    return NextResponse.json({
      message: `Recalculated bonuses for ${result.processed} completed job card(s)`,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/bonus-reports/recalculate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to recalculate bonuses" },
      { status: 500 },
    );
  }
}
