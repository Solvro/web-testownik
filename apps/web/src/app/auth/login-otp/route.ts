import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";

// 303 turns the form POST into a GET on the redirect target.
function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

// Form POST keeps the email and code out of URLs, where analytics and logs would see them.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get("email");
  const otp = formData.get("otp");
  const guestId = formData.get("guest_id");

  if (typeof email !== "string" || email.trim() === "") {
    return redirectTo("/login-otp?error=missing_email", request);
  }

  if (typeof otp !== "string" || otp.trim() === "") {
    return redirectTo("/login-otp/code?error=missing_otp", request);
  }

  try {
    const backendResponse = await fetch(`${API_URL}/login-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        otp,
        ...(typeof guestId === "string" && guestId !== ""
          ? { guest_id: guestId }
          : {}),
      }),
    });

    if (!backendResponse.ok) {
      console.error("Failed to login with OTP", await backendResponse.json());
      return redirectTo("/login-otp/code?error=invalid_otp", request);
    }

    const result = redirectTo("/", request);

    const setCookieHeaders = backendResponse.headers.getSetCookie();
    for (const cookie of setCookieHeaders) {
      result.headers.append("Set-Cookie", cookie);
    }

    return result;
  } catch {
    return redirectTo("/login-otp/code?error=server_error", request);
  }
}
