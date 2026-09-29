import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/mobile/wrapped/route";

const mocks = vi.hoisted(() => ({
  token: "embedded-token",
  verify: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => ({ value: mocks.token }) }),
}));
vi.mock("@/lib/api", () => ({ API_URL: "https://api.example.test/api" }));
vi.mock("@/lib/auth/jwt-utils.server", () => ({
  verifyAccessToken: mocks.verify,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.verify.mockResolvedValue({ mobile_embed: true, token_type: "access" });
});
afterEach(() => vi.unstubAllGlobals());

describe("embedded Wrapped reports", () => {
  it("uses the HttpOnly session and a fixed API destination", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ term: "test" }));
    const response = await GET(
      new NextRequest(
        "https://web.example.test/auth/mobile/wrapped?url=https://untrusted.test",
      ),
    );
    expect(await response.json()).toEqual({ term: "test" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/wrapped/",
      expect.objectContaining({
        headers: { Authorization: "Bearer embedded-token" },
        redirect: "error",
        cache: "no-store",
      }),
    );
  });
  it("selects the community report explicitly", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ global: true }));
    await GET(
      new NextRequest(
        "https://web.example.test/auth/mobile/wrapped?global=true",
      ),
    );
    expect(mocks.fetch.mock.calls[0][0]).toBe(
      "https://api.example.test/api/wrapped/global/",
    );
  });
  it.each([
    null,
    { token_type: "access" },
    { mobile_embed: true, token_type: "refresh" },
  ])("rejects a session without embedded access: %s", async (payload) => {
    mocks.verify.mockResolvedValue(payload);
    const response = await GET(
      new NextRequest("https://web.example.test/auth/mobile/wrapped"),
    );
    expect(response.status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("preserves a backend rejection without disclosing its response", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({ internal: "private diagnostic" }, { status: 403 }),
    );
    const response = await GET(
      new NextRequest("https://web.example.test/auth/mobile/wrapped"),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Report unavailable" });
  });
});
