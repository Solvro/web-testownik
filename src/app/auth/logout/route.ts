import { NextResponse } from "next/server";

import { AUTH_COOKIES, GUEST_COOKIE_NAME } from "@/lib/auth/constants";

export function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(AUTH_COOKIES.ACCESS_TOKEN, "", {
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(AUTH_COOKIES.REFRESH_TOKEN, "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
  });

  response.cookies.set(GUEST_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}
