import { NextRequest, NextResponse } from "next/server";
import { increaseStock, decreaseStock, adjustStock } from "@/lib/stock";
import { prisma } from "@/lib/prisma";

// POST /api/parts/[id]/stock — update stock
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid part ID" }, { status: 400 });
    }

    const body = await req.json();
    const { action, quantity, type, note } = body;

    if (!action || !["increase", "decrease", "adjust"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'increase', 'decrease', or 'adjust'" },
        { status: 400 }
      );
    }

    if (quantity == null || typeof quantity !== "number") {
      return NextResponse.json(
        { error: "Quantity is required and must be a number" },
        { status: 400 }
      );
    }

    let result;
    if (action === "increase") {
      result = await increaseStock(id, quantity, type || "purchase", note);
    } else if (action === "decrease") {
      result = await decreaseStock(id, quantity, type || "sale", note);
    } else {
      result = await adjustStock(id, quantity, note);
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update stock";
    const status = message.includes("not found") ? 404 : message.includes("Insufficient") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// GET /api/parts/[id]/stock — get stock logs for a part
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid part ID" }, { status: 400 });
    }

    const logs = await prisma.stockLog.findMany({
      where: { partId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error(`GET /api/parts/${params.id}/stock error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch stock logs" },
      { status: 500 }
    );
  }
}
