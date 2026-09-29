import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/jwt-utils.server";

const parts = {
  metadata: "metadata/",
  summary: "stats/",
  timeline: "stats/timeline/",
  sessions: "stats/sessions/",
  hardest: "stats/hardest-questions/",
  hourly: "stats/hourly/",
} as const;
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const expired = () =>
    Response.json({ error: "Session expired" }, { status: 401, headers });
  if (token === undefined || token === "") {
    return expired();
  }
  const user = await verifyAccessToken(token);
  if (user?.token_type !== "access" || user.mobile_embed !== true) {
    return expired();
  }
  const input = request.nextUrl.searchParams;
  const id = input.get("id") ?? "";
  const part = input.get("part") ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !Object.hasOwn(parts, part)
  ) {
    return Response.json({ error: "Invalid report" }, { status: 400, headers });
  }
  const query = new URLSearchParams({
    scope: input.get("scope") === "all" ? "all" : "me",
  });
  for (const key of ["days", "limit"] as const) {
    const value = input.get(key);
    if (value !== null) {
      if (
        !/^\d{1,3}$/.test(value) ||
        Number(value) < 1 ||
        Number(value) > 365
      ) {
        return Response.json(
          { error: "Invalid range" },
          { status: 400, headers },
        );
      }
      query.set(key, value);
    }
  }
  try {
    const response = await fetch(
      `${API_URL.replace(/\/$/, "")}/quizzes/${id}/${parts[part as keyof typeof parts]}?${query.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      return Response.json(
        { error: "Statistics unavailable" },
        { status: response.status, headers },
      );
    }
    return Response.json(await response.json(), { headers });
  } catch {
    return Response.json(
      { error: "Statistics unavailable" },
      { status: 502, headers },
    );
  }
}
