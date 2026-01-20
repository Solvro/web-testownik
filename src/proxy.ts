import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  AUTH_COOKIES,
  refreshTokens,
  setAuthCookies,
  verifyAccessToken,
} from "@/lib/auth";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/profile",
  "/quizzes",
  "/grades",
  "/create-quiz",
  "/edit-quiz",
  "/import-quiz",
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIES.REFRESH_TOKEN)?.value;

  const response = NextResponse.next();

  if (accessToken !== undefined && accessToken !== "") {
    const payload = await verifyAccessToken(accessToken);
    if (payload !== null) {
      return response;
    }
  }

  // Try to refresh the token if we have a refresh token
  if (refreshToken !== undefined && refreshToken !== "") {
    const tokens = await refreshTokens(refreshToken);
    if (tokens !== null) {
      setAuthCookies(response, tokens);
      return response;
    }
  }

  // No valid auth - redirect if protected route
  if (isProtectedRoute(request.nextUrl.pathname)) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("auth_required", "true");
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // eslint-disable-next-line unicorn/prefer-string-raw
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
