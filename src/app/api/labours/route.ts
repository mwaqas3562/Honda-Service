import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/labours — list all labours
export async function GET() {
  try {
    const labours = await prisma.labour.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(labours);
  } catch (error) {
    console.error("GET /api/labours error:", error);
    return NextResponse.json({ error: "Failed to fetch labours" }, { status: 500 });
  }
}

// POST /api/labours — create a labour
export async function POST(req: NextRequest) {
  try {
    const { name, defaultPrice, notes } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Labour name is required" }, { status: 400 });
    }
    if (defaultPrice == null || Number(defaultPrice) < 0) {
      return NextResponse.json({ error: "Default price must be non-negative" }, { status: 400 });
    }

    const labour = await prisma.labour.create({
      data: {
        name: name.trim(),
        defaultPrice: Number(defaultPrice),
        notes: notes?.trim() || null,
      },
    });
    return NextResponse.json(labour, { status: 201 });
  } catch (error) {
    console.error("POST /api/labours error:", error);
    return NextResponse.json({ error: "Failed to create labour" }, { status: 500 });
  }
}
