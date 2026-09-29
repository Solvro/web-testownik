import { cookies } from "next/headers";
import "server-only";

import { env } from "@/env";
import { API_URL } from "@/lib/api";

import { AUTH_COOKIES } from "./constants";
import { verifyAccessToken } from "./jwt-utils.server";
import type { JWTPayload } from "./types";

export async function getServerCurrentUser(
  request?: Request,
): Promise<JWTPayload | null> {
  const authorization = request?.headers.get("authorization");
  if (authorization !== null && authorization !== undefined) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (match === null) {
      return null;
    }
    if (match[1].split(".").length === 3) {
      const payload = await verifyAccessToken(match[1]);
      return payload?.token_type === "access" && payload.mobile_embed !== true
        ? payload
        : null;
    }
    // Opaque OAuth tokens are validated by the authorization server, including ai:write.
    // Never fall back to a browser cookie when an explicit bearer credential fails.
    try {
      const response = await fetch(`${API_URL}/oauth/identity/`, {
        headers: { Authorization: `Bearer ${match[1]}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return null;
      }
      const identity = (await response.json()) as JWTPayload;
      return typeof identity.user_id === "string" &&
        identity.token_type === "access"
        ? identity
        : null;
    } catch {
      return null;
    }
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  if (token === undefined || token.trim() === "") {
    return null;
  }

  const payload = await verifyAccessToken(token);
  return request !== undefined && payload?.mobile_embed === true
    ? null
    : payload;
}

export async function createGuestAccount(): Promise<Response | null> {
  try {
    if (env.INTERNAL_API_KEY === undefined || env.INTERNAL_API_KEY === "") {
      console.error("INTERNAL_API_KEY environment variable is not set");
      return null;
    }

    const backendResponse = await fetch(`${API_URL}/guest/create/`, {
      method: "POST",
      headers: {
        "Api-Key": env.INTERNAL_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!backendResponse.ok) {
      return null;
    }

    return backendResponse;
  } catch {
    return null;
  }
}
