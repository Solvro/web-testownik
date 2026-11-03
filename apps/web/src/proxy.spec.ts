import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIES } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/auth/server";
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

describe("proxy auth", () => {
  const expiredSession = `${AUTH_COOKIES.ACCESS_TOKEN}=expired; ${AUTH_COOKIES.REFRESH_TOKEN}=refresh`;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(verifyAccessToken).mockReset();
  });

  function stubRefresh(response: Response) {
    vi.mocked(verifyAccessToken).mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it.each(["/models/device-stack.glb", "/favicon.svg", "/robots.txt"])(
    "passes %s through without touching the session",
    async (pathname) => {
      const fetchMock = stubRefresh(new Response("{}", { status: 200 }));
      const response = await proxy(
        new NextRequest(`http://localhost${pathname}`, {
          headers: {
            cookie: expiredSession,
            [DOCUMENT_SHELL_HEADER]: BARE_DOCUMENT_SHELL,
          },
        }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(verifyAccessToken).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBeNull();
      expect(
        response.headers.get(`x-middleware-request-${DOCUMENT_SHELL_HEADER}`),
      ).toBeNull();
    },
  );

  it("skips the session for every public directory", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(null);
    const publicDirectory = path.resolve(import.meta.dirname, "../public");
    const directories = readdirSync(publicDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(directories).toContain("models");
    for (const directory of directories) {
      await proxy(
        new NextRequest(`http://localhost/${directory}/nested/asset`, {
          headers: { cookie: expiredSession },
        }),
      );
    }
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes app routes whose parameter looks like a file", async () => {
    const fetchMock = stubRefresh(
      new Response("{}", {
        status: 200,
        headers: { "set-cookie": `${AUTH_COOKIES.ACCESS_TOKEN}=fresh` },
      }),
    );
    const response = await proxy(
      new NextRequest("http://localhost/quiz/review-probe.svg", {
        headers: { cookie: expiredSession },
      }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(
      "http://localhost/quiz/review-probe.svg",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not let caches keep the ban redirect", async () => {
    stubRefresh(
      Response.json(
        { code: "user_banned", ban_reason: "spam" },
        { status: 401 },
      ),
    );
    const response = await proxy(
      new NextRequest("http://localhost/quizzes", {
        headers: { cookie: expiredSession },
      }),
    );
    expect(response.headers.get("location")).toContain("error=user_banned");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
