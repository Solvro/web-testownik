import { cookies } from "next/headers";
import "server-only";

import { env } from "@/env";
import { API_URL } from "@/lib/api";

import { AUTH_COOKIES } from "./constants";
import { decodeAccessToken } from "./jwt-utils";
import type { JWTPayload } from "./types";

export async function getServerCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  if (token === undefined || token.trim() === "") {
    return null;
  }

  return decodeAccessToken(token);
}

export async function createGuestAccount(): Promise<Response | null> {
  try {
    const backendResponse = await fetch(`${API_URL}/guest/create/`, {
      method: "POST",
      headers: {
        "Api-Key": env.INTERNAL_API_KEY ?? "",
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
