import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const otp = request.nextUrl.searchParams.get("otp");

  if (email === null || email.trim() === "") {
    return NextResponse.redirect(
      new URL("/login-otp?error=missing_email", request.url),
    );
  }

  if (otp === null || otp.trim() === "") {
    return NextResponse.redirect(
      new URL(
        `/login-otp/code?email=${encodeURIComponent(email)}&error=missing_otp`,
        request.url,
      ),
    );
  }

  try {
    const guestId = request.nextUrl.searchParams.get("guest_id");

    const backendResponse = await fetch(`${API_URL}/login-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        otp,
        ...(guestId === null ? {} : { guest_id: guestId }),
      }),
    });

    if (!backendResponse.ok) {
      console.error("Failed to login with OTP", await backendResponse.json());
      return NextResponse.redirect(
        new URL(
          `/login-otp/code?email=${encodeURIComponent(email)}&error=invalid_otp`,
          request.url,
        ),
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
    return NextResponse.redirect(
      new URL(
        `/login-otp/code?email=${encodeURIComponent(email)}&error=server_error`,
        request.url,
      ),
    );
  }
}
