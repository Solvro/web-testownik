import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/env";
import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/auth/server";
import {
  BARE_DOCUMENT_SHELL,
  DOCUMENT_PATHNAME_HEADER,
  DOCUMENT_SHELL_HEADER,
  isBareDocumentPath,
} from "@/lib/document-shell";

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

/** Auth redirects carry cookies for one user, so no cache may keep them. */
function authRedirect(url: string | URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Directories of `public/`. A single root segment with an extension is a
 * public file or a metadata route (`/robots.txt`); neither needs the session.
 * Dynamic routes such as `/quiz/[quizId]` keep the session check whatever
 * their parameter looks like.
 */
const PUBLIC_ASSET_PREFIXES = [
  "/banned-screen/",
  "/favicon/",
  "/images/",
  "/models/",
  "/sounds/",
];

function isPublicAssetPath(pathname: string): boolean {
  return (
    PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    /^\/[^/]+\.[a-z0-9]+$/i.test(pathname)
  );
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

        const response = authRedirect(url);
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

    const response = authRedirect(redirectUrl);
    forwardAuthCookies(backendResponse, response);
    return response;
  } catch {
    return null;
  }
}

/** See `lib/document-shell.ts`. */
function nextWithDocumentShell(request: NextRequest): NextResponse {
  const isBare = isBareDocumentPath(request.nextUrl.pathname);
  const headers = new Headers(request.headers);
  headers.delete(DOCUMENT_SHELL_HEADER);
  headers.set(DOCUMENT_PATHNAME_HEADER, request.nextUrl.pathname);
  if (isBare) {
    headers.set(DOCUMENT_SHELL_HEADER, BARE_DOCUMENT_SHELL);
  }
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  // The landing's device screens and static files never need the session.
  if (
    isBareDocumentPath(request.nextUrl.pathname) ||
    isPublicAssetPath(request.nextUrl.pathname)
  ) {
    return nextWithDocumentShell(request);
  }

  const accessToken = request.cookies.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIES.REFRESH_TOKEN)?.value;

  const response = nextWithDocumentShell(request);

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
  // Only Next.js internals bypass sanitization. App route parameters can have
  // any extension; public assets pass through sanitized, without the session.
  matcher: ["/((?!_next/).*)"],
};
