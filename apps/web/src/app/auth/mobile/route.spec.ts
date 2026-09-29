import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocked = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/jwt-utils.server", () => ({
  verifyAccessToken: mocked.verify,
}));

beforeEach(() => {
  vi.clearAllMocks();
});
const request = (query = "", origin?: string) =>
  new NextRequest(`http://local/auth/mobile${query}`, {
    headers: {
      Authorization: "Bearer embedded-token",
      ...(origin === undefined ? {} : { Origin: origin }),
    },
  });
describe("isolated native web session", () => {
  it("sets an HTTP-only cookie and redirects to Wrapped without leaking the token", async () => {
    mocked.verify.mockResolvedValue({
      token_type: "access",
      mobile_embed: true,
      exp: 2_000_000_000,
    });
    const r = await GET(request());
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/wrapped");
    expect(r.cookies.get("access_token")?.value).toBe("embedded-token");
    expect(r.headers.get("set-cookie")).toContain("HttpOnly");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects cross-origin requests before validating credentials", async () => {
    const response = await GET(request("", "https://untrusted.invalid"));
    expect(response.status).toBe(403);
    expect(mocked.verify).not.toHaveBeenCalled();
  });
  it("rejects browser navigation without the native authorization header", async () => {
    const response = await GET(
      new NextRequest("http://local/auth/mobile?access=embedded-token"),
    );
    expect(response.status).toBe(401);
  });
  it("requires a specifically issued access token, not a normal login or refresh token", async () => {
    for (const payload of [
      { token_type: "access" },
      { token_type: "refresh", mobile_embed: true },
      null,
    ]) {
      mocked.verify.mockResolvedValue(payload);
      const response = await GET(request());
      expect(response.status).toBe(401);
    }
  });
  it("ignores arbitrary redirect destinations", async () => {
    mocked.verify.mockResolvedValue({
      token_type: "access",
      mobile_embed: true,
      exp: 2_000_000_000,
    });
    const r = await GET(
      request("?global=true&redirect=https://untrusted.invalid"),
    );
    expect(r.headers.get("location")).toBe("/wrapped/global");
  });
  it("opens only a validated quiz statistics destination", async () => {
    mocked.verify.mockResolvedValue({
      token_type: "access",
      mobile_embed: true,
      exp: 2_000_000_000,
    });
    const id = "12345678-1234-1234-1234-123456789012";
    const response = await GET(request(`?quiz=${id}`));
    expect(response.headers.get("location")).toBe(`/quiz/${id}/stats`);
    expect(response.headers.get("location")).not.toContain("embedded-token");
    for (const value of [
      "../admin",
      "https://untrusted.invalid",
      "",
      `${id}/../admin`,
    ]) {
      const rejected = await GET(request(`?quiz=${encodeURIComponent(value)}`));
      expect(rejected.status).toBe(400);
    }
  });
});
