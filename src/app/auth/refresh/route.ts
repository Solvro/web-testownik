import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(AUTH_COOKIES.REFRESH_TOKEN)?.value;

  if (refreshToken === undefined || refreshToken.trim() === "") {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

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
        return NextResponse.json(
          {
            error: "User banned",
            code: data.code,
            ban_reason: data.ban_reason,
          },
          { status: 401 },
        );
      }

      return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    }

    const result = NextResponse.json({ success: true });
    const setCookieHeaders = backendResponse.headers.getSetCookie();
    for (const cookie of setCookieHeaders) {
      result.headers.append("Set-Cookie", cookie);
    }

    return result;
  } catch {
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
