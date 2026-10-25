import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import {
  BARE_DOCUMENT_SHELL,
  DOCUMENT_PATHNAME_HEADER,
  DOCUMENT_SHELL_HEADER,
  shouldRenderBareDocument,
} from "@/lib/document-shell";

import { config, proxy } from "./proxy";

vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/api", () => ({ API_URL: "http://test.local" }));
vi.mock("@/lib/auth/server", () => ({ verifyAccessToken: vi.fn() }));

describe("proxy document shell headers", () => {
  it.each([
    "/quiz/review-probe.json",
    "/quiz/review-probe.svg",
    "/quiz/review-probe.webmanifest",
    "/favicon.svg",
  ])("sanitizes forged shell and pathname headers on %s", async (pathname) => {
    expect(unstable_doesMiddlewareMatch({ config, url: pathname })).toBe(true);
    const response = await proxy(
      new NextRequest(`http://localhost${pathname}`, {
        headers: {
          [DOCUMENT_SHELL_HEADER]: BARE_DOCUMENT_SHELL,
          [DOCUMENT_PATHNAME_HEADER]: "/landing-screen/quiz",
        },
      }),
    );
    expect(
      response.headers.get(`x-middleware-request-${DOCUMENT_SHELL_HEADER}`),
    ).toBeNull();
    expect(
      response.headers.get(`x-middleware-request-${DOCUMENT_PATHNAME_HEADER}`),
    ).toBe(pathname);
    expect(
      response.headers.get("x-middleware-override-headers")?.split(","),
    ).not.toContain(DOCUMENT_SHELL_HEADER);
  });

  it("marks only real landing screen requests as bare", async () => {
    const pathname = "/landing-screen/quiz";
    expect(unstable_doesMiddlewareMatch({ config, url: pathname })).toBe(true);
    const response = await proxy(
      new NextRequest(`http://localhost${pathname}`, {
        headers: {
          [DOCUMENT_SHELL_HEADER]: "app",
          [DOCUMENT_PATHNAME_HEADER]: "/quiz/review-probe.json",
        },
      }),
    );
    const forwarded = new Headers();
    for (const name of [DOCUMENT_SHELL_HEADER, DOCUMENT_PATHNAME_HEADER]) {
      forwarded.set(
        name,
        response.headers.get(`x-middleware-request-${name}`) ?? "",
      );
    }
    expect(shouldRenderBareDocument(forwarded)).toBe(true);
  });

  it("excludes only the internal Next.js paths", () => {
    expect(
      unstable_doesMiddlewareMatch({ config, url: "/_next/static/chunk.js" }),
    ).toBe(false);
  });
});
