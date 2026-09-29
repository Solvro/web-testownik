import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIES } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/jwt-utils.server";

/** Native WebViews bootstrap an isolated cookie using a header, never a URL token. */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const authorization = request.headers.get("authorization");
  const token =
    authorization?.startsWith("Bearer ") === true
      ? authorization.slice(7)
      : null;
  if (token === null || token === "") {
    return new NextResponse("Missing session", { status: 401 });
  }
  const user = await verifyAccessToken(token);
  if (user?.token_type !== "access" || user.mobile_embed !== true) {
    return new NextResponse("Invalid session", { status: 401 });
  }
  const quiz = request.nextUrl.searchParams.get("quiz");
  if (
    quiz !== null &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      quiz,
    )
  ) {
    return new NextResponse("Invalid quiz", { status: 400 });
  }
  const destination =
    quiz === null
      ? request.nextUrl.searchParams.get("global") === "true"
        ? "/wrapped/global"
        : "/wrapped"
      : `/quiz/${quiz}/stats`;
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: destination },
  });
  response.cookies.set(AUTH_COOKIES.ACCESS_TOKEN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(user.exp * 1000),
  });
  response.cookies.delete(AUTH_COOKIES.REFRESH_TOKEN);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
