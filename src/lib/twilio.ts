import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
const smsFrom = process.env.TWILIO_SMS_FROM;           // e.g. "+14155238886"

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  return twilio(accountSid, authToken);
}

function formatPhone(phone: string): string {
  // Ensure phone starts with country code
  let cleaned = phone.replace(/[^0-9+]/g, "");
  if (!cleaned.startsWith("+")) {
    // Default to Pakistan country code if no prefix
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    cleaned = "+92" + cleaned;
  }
  return cleaned;
}

export interface SendResult {
  success: boolean;
  sid?: string;
  channel: "whatsapp" | "sms";
  error?: string;
}

/**
 * Send a message via WhatsApp. Returns success/failure.
 */
async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  if (!whatsappFrom) {
    return { success: false, channel: "whatsapp", error: "TWILIO_WHATSAPP_FROM not configured" };
  }
  try {
    const client = getClient();
    const message = await client.messages.create({
      from: whatsappFrom.startsWith("whatsapp:") ? whatsappFrom : `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${formatPhone(to)}`,
      body,
    });
    return { success: true, sid: message.sid, channel: "whatsapp" };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "WhatsApp send failed";
    return { success: false, channel: "whatsapp", error: errorMsg };
  }
}

/**
 * Send a message via SMS. Returns success/failure.
 */
async function sendSMS(to: string, body: string): Promise<SendResult> {
  if (!smsFrom) {
    return { success: false, channel: "sms", error: "TWILIO_SMS_FROM not configured" };
  }
  try {
    const client = getClient();
    const message = await client.messages.create({
      from: smsFrom,
      to: formatPhone(to),
      body,
    });
    return { success: true, sid: message.sid, channel: "sms" };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "SMS send failed";
    return { success: false, channel: "sms", error: errorMsg };
  }
}

/**
 * Send reminder: try WhatsApp first, fall back to SMS on failure.
 */
export async function sendReminder(to: string, body: string): Promise<SendResult> {
  // Try WhatsApp first
  if (whatsappFrom) {
    const waResult = await sendWhatsApp(to, body);
    if (waResult.success) return waResult;
  }

  // Fallback to SMS
  return sendSMS(to, body);
}

/**
 * Check if Twilio is configured (for UI status display).
 */
export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && (whatsappFrom || smsFrom));
}
