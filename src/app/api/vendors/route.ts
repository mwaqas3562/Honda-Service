import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vendors
export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { purchases: true } } },
    });
    return NextResponse.json(vendors);
  } catch (error) {
    console.error("GET /api/vendors error:", error);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}

// POST /api/vendors
export async function POST(req: NextRequest) {
  try {
    const { name, phone, address } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: { name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error("POST /api/vendors error:", error);
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }
}
