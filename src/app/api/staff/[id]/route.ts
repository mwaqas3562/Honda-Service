import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_ROLES = ["job_card_person", "mechanic", "store_keeper", "admin", "wheel_balancer"];
const VALID_STATUSES = ["active", "inactive"];

// PUT /api/staff/[id] — update staff member
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, role, contact, status } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      updateData.name = name.trim();
    }
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      updateData.role = role;
    }
    if (contact !== undefined) {
      updateData.contact = contact?.trim() || null;
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      updateData.status = status;
    }
    if (body.baseSalary !== undefined) {
      const sal = Number(body.baseSalary);
      if (isNaN(sal) || sal < 0) return NextResponse.json({ error: "Invalid base salary" }, { status: 400 });
      updateData.baseSalary = sal;
    }

    const staff = await prisma.staff.update({
      where: { id: staffId },
      data: updateData,
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error("PUT /api/staff/[id] error:", error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}

// DELETE /api/staff/[id] — soft-delete staff member
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if staff has job card assignments
    const assignmentCount = await prisma.jobCardStaff.count({ where: { staffId } });
    if (assignmentCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete — staff is assigned to ${assignmentCount} job card(s). Remove assignments first.` },
        { status: 409 }
      );
    }

    await prisma.staff.update({ where: { id: staffId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/staff/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete staff" }, { status: 500 });
  }
}
