import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (token === null || token.trim() === "") {
    return NextResponse.redirect(new URL("/?error=missing_token", request.url));
  }

  try {
    const guestId = request.nextUrl.searchParams.get("guest_id");

    const backendResponse = await fetch(`${API_URL}/login-link/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        ...(guestId === null ? {} : { guest_id: guestId }),
      }),
    });

    if (!backendResponse.ok) {
      return NextResponse.redirect(
        new URL("/?error=invalid_token", request.url),
      );
    }

    const redirectUrl = new URL("/", request.url);
    const result = NextResponse.redirect(redirectUrl);

    const setCookieHeaders = backendResponse.headers.getSetCookie();
    for (const cookie of setCookieHeaders) {
      result.headers.append("Set-Cookie", cookie);
    }

    return result;
  } catch {
    return NextResponse.redirect(new URL("/?error=server_error", request.url));
  }
}
