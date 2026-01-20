import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIES, refreshTokens, setAuthCookies } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(AUTH_COOKIES.REFRESH_TOKEN)?.value;

  if (refreshToken === undefined || refreshToken.trim() === "") {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  try {
    const tokens = await refreshTokens(refreshToken);

    if (tokens === null) {
      return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    }

    const result = NextResponse.json({ success: true });
    setAuthCookies(result, tokens);

    return result;
  } catch {
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
