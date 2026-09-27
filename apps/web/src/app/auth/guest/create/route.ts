import { NextResponse } from "next/server";

import { createGuestAccount } from "@/lib/auth/server";

export async function POST(_request: Request) {
  const backendResponse = await createGuestAccount();

  if (backendResponse === null) {
    return NextResponse.json(
      { error: "Failed to create guest account" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ success: true });

  const setCookieHeaders = backendResponse.headers.getSetCookie();
  for (const cookie of setCookieHeaders) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
