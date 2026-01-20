import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";
import { AUTH_COOKIES, verifyAccessToken } from "@/lib/auth";
import { GUEST_COOKIE_NAME } from "@/lib/auth/constants";

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

/**
 * Forward Set-Cookie headers from backend response to Next.js response.
 */
function forwardAuthCookies(
  backendResponse: Response,
  nextResponse: NextResponse,
): void {
  const setCookieHeaders = backendResponse.headers.getSetCookie();
  for (const cookie of setCookieHeaders) {
    nextResponse.headers.append("Set-Cookie", cookie);
  }
}

/**
 * Try to refresh tokens using the backend and forward cookies.
 */
async function tryRefreshTokens(
  refreshToken: string,
  response: NextResponse,
): Promise<boolean> {
  try {
    const backendResponse = await fetch(`${API_URL}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!backendResponse.ok) {
      return false;
    }

    forwardAuthCookies(backendResponse, response);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIES.REFRESH_TOKEN)?.value;
  const isGuest = request.cookies.get(GUEST_COOKIE_NAME)?.value === "true";

  const response = NextResponse.next();

  if (isGuest) {
    return response;
  }

  if (accessToken !== undefined && accessToken !== "") {
    const payload = await verifyAccessToken(accessToken);
    if (payload !== null) {
      return response;
    }
  }

  // Try to refresh the token if we have a refresh token
  if (refreshToken !== undefined && refreshToken !== "") {
    const refreshed = await tryRefreshTokens(refreshToken, response);
    if (refreshed) {
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
