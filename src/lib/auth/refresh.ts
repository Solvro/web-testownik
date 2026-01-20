import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import type { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";

import { AUTH_COOKIES } from "./constants";
import { decodeAccessToken } from "./jwt-utils";
import type { TokenRefreshResponse } from "./types";

/**
 * Call backend to refresh tokens.
 * Returns new tokens or null if refresh fails.
 */
export async function refreshTokens(
  refreshToken: string,
): Promise<TokenRefreshResponse | null> {
  try {
    const response = await fetch(`${API_URL}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TokenRefreshResponse;
  } catch {
    return null;
  }
}

/**
 * Calculate expiration Date from JWT payload.
 * Returns a default expiration if payload is missing.
 */
export function getTokenExpiration(
  token: string,
  defaultSeconds: number,
): Date {
  const payload = decodeAccessToken(token);
  if (payload?.exp === undefined) {
    return new Date(Date.now() + defaultSeconds * 1000);
  }
  return new Date(payload.exp * 1000);
}

/**
 * Build cookie options for access token.
 */
export function getAccessTokenCookieOptions(
  accessToken: string,
): Partial<ResponseCookie> {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: getTokenExpiration(accessToken, 3600),
  };
}

/**
 * Build cookie options for refresh token.
 */
export function getRefreshTokenCookieOptions(
  refreshToken: string,
): Partial<ResponseCookie> {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    expires: getTokenExpiration(refreshToken, 30 * 24 * 60 * 60),
  };
}

/**
 * Set auth cookies on a NextResponse.
 */
export function setAuthCookies(
  response: NextResponse,
  tokens: TokenRefreshResponse,
): void {
  response.cookies.set(
    AUTH_COOKIES.ACCESS_TOKEN,
    tokens.access,
    getAccessTokenCookieOptions(tokens.access),
  );
  response.cookies.set(
    AUTH_COOKIES.REFRESH_TOKEN,
    tokens.refresh,
    getRefreshTokenCookieOptions(tokens.refresh),
  );
}
