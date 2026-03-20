import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

// POST /api/auth/logout
export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
