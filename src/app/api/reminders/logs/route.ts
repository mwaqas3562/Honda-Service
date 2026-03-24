import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reminders/logs
 * View reminder history (paginated, filterable).
 *
 * Query params:
 *   page       — page number (default 1)
 *   limit      — items per page (default 50)
 *   dateFrom   — filter from date
 *   dateTo     — filter to date
 *   type       — filter by messageType
 *   status     — filter by status
 *   search     — search by name or phone
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (dateFrom || dateTo) {
      where.sentAt = {};
      if (dateFrom) where.sentAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.sentAt.lte = end;
      }
    }

    if (type) where.messageType = type;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.reminderLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reminderLog.count({ where }),
    ]);

    // Summary stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [sentToday, failedToday, totalThisMonth] = await Promise.all([
      prisma.reminderLog.count({
        where: { sentAt: { gte: today, lt: tomorrow }, status: { not: "failed" } },
      }),
      prisma.reminderLog.count({
        where: { sentAt: { gte: today, lt: tomorrow }, status: "failed" },
      }),
      prisma.reminderLog.count({
        where: {
          sentAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
      }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        sentToday,
        failedToday,
        totalThisMonth,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Logs fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
