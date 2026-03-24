import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { fetchCustomerProfiles } from "@/lib/reminder-service";
import { evaluateAll } from "@/lib/reminder-engine";
import { getMessageContent } from "@/lib/reminder-templates";

/**
 * GET /api/reminders/eligible
 * Preview: shows which customers would receive reminders (dry run).
 */
export async function GET() {
  try {
    await requireAdmin();

    const profiles = await fetchCustomerProfiles();
    const decisions = evaluateAll(profiles, new Date());

    const eligible = decisions.map((d) => ({
      customerPhone: d.customerPhone,
      customerName: d.customerName,
      bikeNumber: d.bikeNumber,
      bikeModel: d.bikeModel,
      messageType: d.messageType,
      priority: d.priority,
      messagePreview: getMessageContent(d.messageType, d.customerName, d.bikeModel),
    }));

    return NextResponse.json({
      total: eligible.length,
      totalProfiles: profiles.length,
      eligible,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Eligible check failed:", err);
    return NextResponse.json({ error: "Failed to check eligible customers" }, { status: 500 });
  }
}
