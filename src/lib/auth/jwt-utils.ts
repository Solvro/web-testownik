import { decodeJwt, jwtVerify } from "jose";

import type { JWTPayload } from "./types";

/**
 * Decode JWT without verification.
 * Safe to use client-side or when token has already been verified.
 * Returns null if token is malformed.
 */
export function decodeAccessToken(token: string): JWTPayload | null {
  try {
    return decodeJwt(token) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired.
 * Adds a 30-second buffer to ensure tokens are refreshed before expiry.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeAccessToken(token);
  if (payload === null) {
    return true;
  }
  // Add 30 second buffer
  return Date.now() >= payload.exp * 1000 - 30_000;
}

/**
 * Verify JWT with secret key (for server-side use only).
 * Returns null if verification fails.
 */
export async function verifyAccessToken(
  token: string,
): Promise<JWTPayload | null> {
  const secret = process.env.JWT_SECRET;
  if (secret === undefined || secret === "") {
    console.error("JWT_SECRET environment variable is not set");
    return null;
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error("Failed to verify access token", error);
    return null;
  }
}
