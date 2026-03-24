import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchCustomerProfiles } from "@/lib/reminder-service";
import { evaluateAll } from "@/lib/reminder-engine";
import { getMessageContent } from "@/lib/reminder-templates";
import { sendReminder } from "@/lib/twilio";
import { ReminderStatus } from "@/generated/prisma/client";

/**
 * POST /api/reminders/send
 * Manual trigger: runs full cycle — fetch → rules → generate → send → log.
 * Body: { dryRun?: boolean }
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // 1. Fetch customer profiles
    const profiles = await fetchCustomerProfiles();

    // 2. Apply rules engine
    const decisions = evaluateAll(profiles, new Date());

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        eligible: decisions.length,
        totalProfiles: profiles.length,
        decisions: decisions.map((d) => ({
          ...d,
          messagePreview: getMessageContent(d.messageType, d.customerName, d.bikeModel),
        })),
      });
    }

    // 3. Send messages and log results
    const results: {
      customerPhone: string;
      customerName: string;
      messageType: string;
      channel: string;
      status: string;
      error?: string;
    }[] = [];

    let sentCount = 0;
    let failedCount = 0;

    for (const decision of decisions) {
      const messageContent = getMessageContent(
        decision.messageType,
        decision.customerName,
        decision.bikeModel
      );

      // Send via Twilio (WhatsApp + SMS fallback)
      const result = await sendReminder(decision.customerPhone, messageContent);

      const status: ReminderStatus = result.success ? "sent" : "failed";

      // Log to database
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

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }

      results.push({
        customerPhone: decision.customerPhone,
        customerName: decision.customerName,
        messageType: decision.messageType,
        channel: result.channel,
        status,
        error: result.error,
      });
    }

    return NextResponse.json({
      sent: sentCount,
      failed: failedCount,
      skipped: profiles.length - decisions.length,
      total: decisions.length,
      results,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Reminder send failed:", err);
    return NextResponse.json({ error: "Failed to send reminders" }, { status: 500 });
  }
}
