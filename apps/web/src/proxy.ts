import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/env";
import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/auth/server";

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
 * Try to refresh tokens using the backend and return a redirect response with cookies.
 * Returns null if refresh failed.
 */
async function tryRefreshTokens(
  refreshToken: string,
  redirectUrl: string,
): Promise<NextResponse | null> {
  try {
    const backendResponse = await fetch(`${API_URL}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!backendResponse.ok) {
      const data = (await backendResponse.json()) as {
        code?: string;
        ban_reason?: string;
      };

      if (data.code === "user_banned") {
        const url = new URL("/", redirectUrl);
        url.searchParams.set("error", "user_banned");
        url.searchParams.set("ban_reason", data.ban_reason ?? "Unknown reason");

        const response = NextResponse.redirect(url);
        response.cookies.delete({
          name: AUTH_COOKIES.ACCESS_TOKEN,
          domain: env.JWT_COOKIE_DOMAIN,
        });
        response.cookies.delete({
          name: AUTH_COOKIES.REFRESH_TOKEN,
          domain: env.JWT_COOKIE_DOMAIN,
        });

        return response;
      }

      return null;
    }

    const response = NextResponse.redirect(redirectUrl);
    forwardAuthCookies(backendResponse, response);
    return response;
  } catch {
    return null;
  }
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
    const refreshResponse = await tryRefreshTokens(refreshToken, request.url);
    if (refreshResponse !== null) {
      return refreshResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    // eslint-disable-next-line unicorn/prefer-string-raw
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|json)$).*)",
  ],
};
