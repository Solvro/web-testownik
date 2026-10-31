import { after } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/env";
import { UMAMI_ORIGIN, UMAMI_WEBSITE_ID } from "@/lib/umami";

import {
  PERKS_PARTNER_URL,
  PERKS_PLACEMENTS,
  PERKS_VARIANT,
} from "../../components/landing-content";
import type { PerksPlacement } from "../../components/landing-content";

const UMAMI_TIMEOUT_MS = 500;

function parsePlacement(value: string | null): PerksPlacement | null {
  return PERKS_PLACEMENTS.find((placement) => placement === value) ?? null;
}

/** Counts the click in Umami; scheduled after the redirect is sent. */
async function sendClickEvent(
  request: NextRequest,
  placement: PerksPlacement | null,
): Promise<void> {
  const userAgent = request.headers.get("user-agent");
  const forwardedFor = request.headers.get("x-forwarded-for");
  try {
    await fetch(`${UMAMI_ORIGIN}/api/send`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(UMAMI_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        // Umami drops events without a browser user agent.
        ...(userAgent === null ? {} : { "User-Agent": userAgent }),
        ...(forwardedFor === null ? {} : { "X-Forwarded-For": forwardedFor }),
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: UMAMI_WEBSITE_ID,
          hostname: new URL(env.NEXT_PUBLIC_SITE_URL).hostname,
          url: "/go/uniperks",
          referrer: request.headers.get("referer") ?? "",
          language: request.headers.get("accept-language")?.split(",")[0] ?? "",
          name: "perks-click",
          data: { placement: placement ?? "unknown", variant: PERKS_VARIANT },
        },
      }),
    });
  } catch (error) {
    console.warn("Umami perks-click failed:", error);
  }
}

/** Redirects to the uniperks partner link, tagged with the clicked placement. */
export function GET(request: NextRequest): Response {
  const placement = parsePlacement(request.nextUrl.searchParams.get("p"));
  const target = new URL(PERKS_PARTNER_URL);
  if (placement !== null) {
    target.searchParams.set("utm_content", placement);
  }

  after(async () => sendClickEvent(request, placement));

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.href,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
