import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMessageContent } from "@/lib/reminder-templates";
import { sendReminder } from "@/lib/twilio";
import { ReminderType, ReminderStatus } from "@/generated/prisma/client";
import * as XLSX from "xlsx";

/* ─── Constants ──────────────────────────── */

const VALID_MESSAGE_TYPES: Set<string> = new Set([
  "engine_tuning",
  "oil_change",
  "missed_visit",
  "comeback",
]);

const PHONE_RE = /^(\+?92|0)?3\d{9}$/;

/* ─── Types ──────────────────────────────── */

interface ParsedRow {
  rowNumber: number;
  phone: string;
  name: string;
  bikeModel: string;
  messageType: string;
  customMessage: string;
  resolvedMessage: string;
  resolvedType: ReminderType;
  errors: string[];
  isDuplicate: boolean;
}

/* ─── Helpers ────────────────────────────── */

function cleanPhone(raw: string): string {
  return String(raw || "").replace(/[\s\-()]/g, "").trim();
}

function parseFile(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9_]/g, "").trim();
}

function findColumn(headers: string[], candidates: string[]): string | null {
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (candidates.includes(norm)) return h;
  }
  return null;
}

function parseRows(rawRows: Record<string, unknown>[]): ParsedRow[] {
  if (rawRows.length === 0) return [];

  const headers = Object.keys(rawRows[0]);

  // Map columns flexibly
  const phoneCol = findColumn(headers, ["phone", "phonenumber", "phone_number", "contact", "mobile", "cell"]);
  const nameCol = findColumn(headers, ["name", "customername", "customer_name", "customer"]);
  const bikeCol = findColumn(headers, ["bike_model", "bikemodel", "bike", "model"]);
  const typeCol = findColumn(headers, ["message_type", "messagetype", "type"]);
  const msgCol = findColumn(headers, ["custom_message", "custommessage", "message", "msg"]);

  const seenPhones = new Set<string>();
  const rows: ParsedRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const errors: string[] = [];

    const phone = cleanPhone(String(phoneCol ? raw[phoneCol] ?? "" : ""));
    const name = String(nameCol ? raw[nameCol] ?? "" : "").trim();
    const bikeModel = String(bikeCol ? raw[bikeCol] ?? "" : "").trim();
    const messageType = String(typeCol ? raw[typeCol] ?? "" : "").trim().toLowerCase();
    const customMessage = String(msgCol ? raw[msgCol] ?? "" : "").trim();

    // Validate phone
    if (!phone) {
      errors.push("Phone is required");
    } else if (!PHONE_RE.test(phone)) {
      errors.push("Invalid phone format (expected Pakistani mobile e.g. 03001234567)");
    }

    // Validate name
    if (!name) {
      errors.push("Name is required");
    }

    // Validate message_type if provided
    if (messageType && !VALID_MESSAGE_TYPES.has(messageType)) {
      errors.push(`Invalid message_type "${messageType}". Valid: ${Array.from(VALID_MESSAGE_TYPES).join(", ")}`);
    }

    // Must have either message_type or custom_message
    if (!messageType && !customMessage) {
      errors.push("Either message_type or custom_message is required");
    }

    // Resolve final message and type
    let resolvedMessage = "";
    let resolvedType: ReminderType = "custom";

    if (customMessage) {
      resolvedMessage = customMessage;
      resolvedType = "custom";
    } else if (messageType && VALID_MESSAGE_TYPES.has(messageType)) {
      resolvedType = messageType as ReminderType;
      resolvedMessage = getMessageContent(resolvedType, name, bikeModel);
    }

    // Check duplicate
    const isDuplicate = seenPhones.has(phone);
    if (phone) seenPhones.add(phone);

    rows.push({
      rowNumber: i + 2, // +2 because row 1 is header, data starts at row 2
      phone,
      name,
      bikeModel,
      messageType,
      customMessage,
      resolvedMessage,
      resolvedType,
      errors,
      isDuplicate,
    });
  }

  return rows;
}

/* ─── Route Handler ──────────────────────── */

/**
 * POST /api/reminders/bulk-send
 * Upload CSV/XLSX file for bulk reminder sending.
 * FormData: file (required), mode ("preview" | "send")
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "preview";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      return NextResponse.json({ error: "Unsupported file type. Use .csv or .xlsx" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawRows = parseFile(buffer);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 });
    }

    const parsed = parseRows(rawRows);
    const validRows = parsed.filter((r) => r.errors.length === 0 && !r.isDuplicate);
    const errorRows = parsed.filter((r) => r.errors.length > 0);
    const duplicateRows = parsed.filter((r) => r.isDuplicate);

    // ─── Preview mode ─────────────────────────
    if (mode === "preview") {
      return NextResponse.json({
        mode: "preview",
        totalRows: parsed.length,
        validCount: validRows.length,
        errorCount: errorRows.length,
        duplicateCount: duplicateRows.length,
        rows: parsed.map((r) => ({
          rowNumber: r.rowNumber,
          phone: r.phone,
          name: r.name,
          bikeModel: r.bikeModel,
          messageType: r.resolvedType,
          resolvedMessage: r.resolvedMessage,
          errors: r.errors,
          isDuplicate: r.isDuplicate,
        })),
      });
    }

    // ─── Send mode ────────────────────────────
    if (validRows.length === 0) {
      return NextResponse.json({
        error: "No valid rows to send. Fix errors and re-upload.",
        errorCount: errorRows.length,
        duplicateCount: duplicateRows.length,
      }, { status: 400 });
    }

    let sentCount = 0;
    let failedCount = 0;
    const results: {
      rowNumber: number;
      phone: string;
      name: string;
      status: string;
      channel: string;
      error?: string;
    }[] = [];

    for (const row of validRows) {
      const result = await sendReminder(row.phone, row.resolvedMessage);
      const status: ReminderStatus = result.success ? "sent" : "failed";

      await prisma.reminderLog.create({
        data: {
          customerPhone: row.phone,
          customerName: row.name,
          bikeNumber: null,
          bikeModel: row.bikeModel || null,
          messageType: row.resolvedType,
          channel: result.channel,
          status,
          priority: 0,
          messageContent: row.resolvedMessage,
          twilioSid: result.sid || null,
          errorMessage: result.error || null,
        },
      });

      if (result.success) sentCount++;
      else failedCount++;

      results.push({
        rowNumber: row.rowNumber,
        phone: row.phone,
        name: row.name,
        status,
        channel: result.channel,
        error: result.error,
      });
    }

    return NextResponse.json({
      mode: "send",
      sent: sentCount,
      failed: failedCount,
      skippedErrors: errorRows.length,
      skippedDuplicates: duplicateRows.length,
      total: validRows.length,
      results,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Bulk send failed:", err);
    return NextResponse.json({ error: "Failed to process bulk upload" }, { status: 500 });
  }
}
