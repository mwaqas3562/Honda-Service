import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

// GET /api/auth/me — check current auth status
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      userId: user.userId,
      email: user.email,
      role: user.role,
    },
  });
}
