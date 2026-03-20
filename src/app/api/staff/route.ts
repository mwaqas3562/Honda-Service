import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_ROLES = ["job_card_person", "mechanic", "store_keeper", "admin", "wheel_balancer"];
const VALID_STATUSES = ["active", "inactive"];

// GET /api/staff — list all staff, with optional search/filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contact: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role && VALID_ROLES.includes(role)) {
      where.role = role;
    }
    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }

    const staff = await prisma.staff.findMany({
      where,
      include: { bonusConfig: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error("GET /api/staff error:", error);
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

// POST /api/staff — create new staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, contact, status } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const staff = await prisma.staff.create({
      data: {
        name: name.trim(),
        role,
        contact: contact?.trim() || null,
        status: status || "active",
        baseSalary: typeof body.baseSalary === "number" ? body.baseSalary : 0,
      },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error("POST /api/staff error:", error);
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 });
  }
}
