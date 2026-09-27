import { NextResponse } from "next/server";

import { env } from "@/env";
import { AUTH_COOKIES } from "@/lib/auth/constants";

export function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(AUTH_COOKIES.ACCESS_TOKEN, "", {
    path: "/",
    maxAge: 0,
    domain: env.JWT_COOKIE_DOMAIN,
  });

  response.cookies.set(AUTH_COOKIES.REFRESH_TOKEN, "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
    domain: env.JWT_COOKIE_DOMAIN,
  });

  return response;
}
