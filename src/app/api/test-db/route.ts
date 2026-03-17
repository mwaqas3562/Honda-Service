import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const partsCount = await prisma.part.count();
    const stockLogsCount = await prisma.stockLog.count();

    return NextResponse.json({
      status: "connected",
      database: "PostgreSQL",
      tables: {
        parts: { count: partsCount },
        stockLogs: { count: stockLogsCount },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database connection error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        message: `Database connection failed: ${message}`,
        hint: "Make sure PostgreSQL is running and DATABASE_URL is correct in .env",
      },
      { status: 500 }
    );
  }
}
