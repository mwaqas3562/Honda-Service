import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/stock-logs — global stock logs with optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    const logs = await prisma.stockLog.findMany({
      where,
      include: { part: { select: { name: true, partNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET /api/stock-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch stock logs" }, { status: 500 });
  }
}
