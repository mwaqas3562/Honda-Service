import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "honda_auth_token";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/login",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API routes → 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    // Pages → redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    // Check ADMIN role
    if (payload.role !== "ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 }
        );
      }
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // If authenticated user visits /login, redirect to dashboard
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    // Token invalid/expired — clear cookie and redirect
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: "Token expired or invalid" },
        { status: 401 }
      );
      response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }
}

// Apply middleware to all routes except static assets
export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match all dashboard/page routes
    "/dashboard/:path*",
    // Match root
    "/",
    // Match login (for redirect-if-authenticated)
    "/login",
  ],
};
