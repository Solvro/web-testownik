import { cookies } from "next/headers";

import { AUTH_COOKIES } from "./constants";
import { decodeAccessToken } from "./jwt-utils";
import type { JWTPayload } from "./types";

/**
 * Get the current user from cookies (server-side).
 */
export async function getServerCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  if (token === undefined || token.trim() === "") {
    return null;
  }

  return decodeAccessToken(token);
}
