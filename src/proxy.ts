import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth";
import { createGuestAccount, verifyAccessToken } from "@/lib/auth/server";

const BOT_UA_PATTERNS =
  /bot|crawl|spider|slurp|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegrambot|discordbot|applebot|bingpreview|googleother|google-inspectiontool|storebot-google|petalbot|yandexbot|baiduspider|duckduckbot|sogou|exabot|ia_archiver|archive\.org_bot|semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot|screaming frog|dataforseo|gptbot|chatgpt-user|claude-web|anthropic-ai|bytespider|amazonbot|ccbot|cohere-ai|diffbot|omgili|paper\.li|feedfetcher|mediapartners-google|adsbot-google|apis-google|google-read-aloud|headlesschrome|phantomjs|prerender|snap url preview|kakaotalk-scrap|daum|naver|yeti|pinterestbot|redditbot|vkshare|w3c_validator|lighthouse|chrome-lighthouse|pagespeed|gtmetrix|uptimerobot|pingdom|statuscake|site24x7|newrelic|datadog/i;

const AUTH_ROUTES = ["/login", "/auth", "/login-otp"];

function shouldCreateGuestAccount(
  pathname: string,
  userAgent: string | null,
): boolean {
  if (pathname === "/") {
    return false;
  }
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return false;
  }
  if (userAgent !== null && BOT_UA_PATTERNS.test(userAgent)) {
    return false;
  }
  return true;
}

/**
 * Forward Set-Cookie headers from backend response to Next.js response.
 */
function forwardAuthCookies(
  backendResponse: Response,
  nextResponse: NextResponse,
): void {
  const setCookieHeaders = backendResponse.headers.getSetCookie();
  for (const cookie of setCookieHeaders) {
    nextResponse.headers.append("Set-Cookie", cookie);
  }
}

/**
 * Try to refresh tokens using the backend and return a redirect response with cookies.
 * Returns null if refresh failed.
 */
async function tryRefreshTokens(
  refreshToken: string,
  redirectUrl: string,
): Promise<NextResponse | null> {
  try {
    const backendResponse = await fetch(`${API_URL}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!backendResponse.ok) {
      const data = (await backendResponse.json()) as {
        code?: string;
        ban_reason?: string;
      };

      if (data.code === "user_banned") {
        const url = new URL("/", redirectUrl);
        url.searchParams.set("error", "user_banned");
        url.searchParams.set("ban_reason", data.ban_reason ?? "Unknown reason");

        const response = NextResponse.redirect(url);
        response.cookies.delete(AUTH_COOKIES.ACCESS_TOKEN);
        response.cookies.delete(AUTH_COOKIES.REFRESH_TOKEN);

        return response;
      }

      return null;
    }

    const response = NextResponse.redirect(redirectUrl);
    forwardAuthCookies(backendResponse, response);
    return response;
  } catch {
    return null;
  }
}

async function createGuestAccountAndRedirect(
  requestUrl: string,
): Promise<NextResponse | null> {
  const backendResponse = await createGuestAccount();

  if (backendResponse === null) {
    return null;
  }

  // Redirect to same URL with a query param to trigger the consent alert
  const url = new URL(requestUrl);
  url.searchParams.set("guest_created", "true");
  const response = NextResponse.redirect(url);

  forwardAuthCookies(backendResponse, response);
  return response;
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIES.REFRESH_TOKEN)?.value;

  const response = NextResponse.next();

  if (accessToken !== undefined && accessToken !== "") {
    const payload = await verifyAccessToken(accessToken);
    if (payload !== null) {
      return response;
    }
  }

  // Try to refresh the token if we have a refresh token
  if (refreshToken !== undefined && refreshToken !== "") {
    const refreshResponse = await tryRefreshTokens(refreshToken, request.url);
    if (refreshResponse !== null) {
      return refreshResponse;
    }
  }

  if (
    shouldCreateGuestAccount(
      request.nextUrl.pathname,
      request.headers.get("user-agent"),
    )
  ) {
    const guestResponse = await createGuestAccountAndRedirect(request.url);
    if (guestResponse !== null) {
      return guestResponse;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // eslint-disable-next-line unicorn/prefer-string-raw
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|json)$).*)",
  ],
};
