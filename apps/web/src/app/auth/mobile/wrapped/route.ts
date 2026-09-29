import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/jwt-utils.server";

/** A fixed, read-only report endpoint for the isolated native WebView session. */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const user = token === undefined ? null : await verifyAccessToken(token);
  const headers = { "Cache-Control": "no-store" };
  if (
    token === undefined ||
    user?.mobile_embed !== true ||
    user.token_type !== "access"
  ) {
    return Response.json(
      { error: "Session expired" },
      { status: 401, headers },
    );
  }
  const path =
    request.nextUrl.searchParams.get("global") === "true"
      ? "wrapped/global/"
      : "wrapped/";
  try {
    const response = await fetch(`${API_URL.replace(/\/$/, "")}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return Response.json(
        { error: "Report unavailable" },
        { status: response.status, headers },
      );
    }
    return Response.json(await response.json(), { headers });
  } catch {
    return Response.json(
      { error: "Report unavailable" },
      { status: 502, headers },
    );
  }
}
