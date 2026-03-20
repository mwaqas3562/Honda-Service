import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";

const VALID_TYPES = ["food", "utility", "misc"];

/* ─── GET /api/expenses?from=&to=&type= ─── */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const type = sp.get("type");

    const where: Record<string, unknown> = {};

    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from + "T00:00:00Z") } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}),
      };
    }

    if (type && VALID_TYPES.includes(type)) {
      where.type = type;
    }

    const page = Math.max(parseInt(sp.get("page") || "1") || 1, 1);
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "100") || 100, 1), 500);
    const skip = (page - 1) * limit;

    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    const total = expenses.reduce((s, e) => s + n(e.amount), 0);

    return NextResponse.json({ expenses, total, count: totalCount, page, limit });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

/* ─── POST /api/expenses ─── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, type, note, date } = body;

    if (!amount || !type || !date) {
      return NextResponse.json({ error: "amount, type, and date are required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: Math.round(amount),
        type,
        note: note || null,
        date: new Date(date + "T00:00:00Z"),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

/* ─── DELETE /api/expenses?id= ─── */
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
