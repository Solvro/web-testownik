import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";

async function login(
  request: NextRequest,
  email: string | null,
  otp: string | null,
  guestId: string | null,
) {
  if (email === null || email.trim() === "") {
    return NextResponse.redirect(
      new URL("/login-otp?error=missing_email", request.url),
      303,
    );
  }

  if (otp === null || otp.trim() === "") {
    return NextResponse.redirect(
      new URL(
        `/login-otp/code?email=${encodeURIComponent(email)}&error=missing_otp`,
        request.url,
      ),
      303,
    );
  }

  try {
    const migrating = guestId !== null && guestId !== "";
    const guestAccessToken = request.cookies.get("access_token")?.value;
    const backendResponse = await fetch(`${API_URL}/login-otp/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(migrating &&
        guestAccessToken !== undefined &&
        guestAccessToken !== ""
          ? {
              Authorization: `Bearer ${guestAccessToken}`,
            }
          : {}),
      },
      body: JSON.stringify({
        email: email.trim(),
        otp,
        ...(guestId === null ? {} : { guest_id: guestId }),
      }),
    });

    if (!backendResponse.ok) {
      return NextResponse.redirect(
        new URL(
          `/login-otp/code?email=${encodeURIComponent(email)}&error=${migrating && backendResponse.status === 403 ? "guest_auth_required" : migrating && backendResponse.status === 409 ? "guest_migration_failed" : "invalid_otp"}`,
          request.url,
        ),
        303,
      );
    }

    const redirectUrl = new URL("/", request.url);
    const result = NextResponse.redirect(redirectUrl, 303);

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
      303,
    );
  }
}

export async function GET(request: NextRequest) {
  // A clicked URL must not borrow the browser's guest cookie to move its data.
  if (request.nextUrl.searchParams.has("guest_id")) {
    return NextResponse.json(
      { error: "Guest migration requires a same-origin form submission." },
      { status: 403 },
    );
  }
  return login(
    request,
    request.nextUrl.searchParams.get("email"),
    request.nextUrl.searchParams.get("otp"),
    null,
  );
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid sign-in origin." },
      { status: 403 },
    );
  }
  const data = await request.formData();
  const value = (key: string) => {
    const entry = data.get(key);
    return typeof entry === "string" ? entry : null;
  };
  return login(request, value("email"), value("otp"), value("guest_id"));
}
