import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";

export async function GET(request: NextRequest) {
  // Email links never carry authority to transfer a browser guest account.
  if (request.nextUrl.searchParams.has("guest_id")) {
    return NextResponse.json(
      { error: "Restart sign-in to transfer guest data securely." },
      { status: 403 },
    );
  }
  const token = request.nextUrl.searchParams.get("token");

  if (token === null || token.trim() === "") {
    return NextResponse.redirect(new URL("/?error=missing_token", request.url));
  }

  try {
    const backendResponse = await fetch(`${API_URL}/login-link/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
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
