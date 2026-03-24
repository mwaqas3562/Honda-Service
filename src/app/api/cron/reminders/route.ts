import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCustomerProfiles } from "@/lib/reminder-service";
import { evaluateAll } from "@/lib/reminder-engine";
import { getMessageContent } from "@/lib/reminder-templates";
import { sendReminder } from "@/lib/twilio";
import { ReminderStatus } from "@/generated/prisma/client";

/**
 * GET /api/cron/reminders
 * Cron trigger — secured via CRON_SECRET header.
 * Called by external cron service (cron-job.org, Vercel Cron, etc.).
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = await fetchCustomerProfiles();
    const decisions = evaluateAll(profiles, new Date());

    let sentCount = 0;
    let failedCount = 0;

    for (const decision of decisions) {
      const messageContent = getMessageContent(
        decision.messageType,
        decision.customerName,
        decision.bikeModel
      );

      const result = await sendReminder(decision.customerPhone, messageContent);
      const status: ReminderStatus = result.success ? "sent" : "failed";

      await prisma.reminderLog.create({
        data: {
          customerPhone: decision.customerPhone,
          customerName: decision.customerName,
          bikeNumber: decision.bikeNumber || null,
          bikeModel: decision.bikeModel || null,
          messageType: decision.messageType,
          channel: result.channel,
          status,
          priority: decision.priority,
          messageContent,
          twilioSid: result.sid || null,
          errorMessage: result.error || null,
        },
      });

      if (result.success) sentCount++;
      else failedCount++;
    }

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      failed: failedCount,
      skipped: profiles.length - decisions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Cron reminder failed:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
