import { decodeJwt } from "jose";

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
