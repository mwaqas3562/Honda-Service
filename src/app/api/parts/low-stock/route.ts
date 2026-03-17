import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const allParts = await prisma.part.findMany({
      orderBy: { stock: "asc" },
    });

    const lowStockParts = allParts.filter((p) => p.stock <= p.minStock);

    return NextResponse.json(lowStockParts);
  } catch (error) {
    console.error("GET /api/parts/low-stock error:", error);
    return NextResponse.json(
      { error: "Failed to fetch low stock parts" },
      { status: 500 }
    );
  }
}
