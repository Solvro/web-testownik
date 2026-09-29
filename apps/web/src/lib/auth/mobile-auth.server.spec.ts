import { beforeEach, describe, expect, it, vi } from "vitest";

import { getServerCurrentUser } from "./utils.server";

const mocked = vi.hoisted(() => ({ cookies: vi.fn(), verify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocked.cookies }));
vi.mock("./jwt-utils.server", () => ({ verifyAccessToken: mocked.verify }));

beforeEach(() => {
  vi.clearAllMocks();
  mocked.cookies.mockResolvedValue({ get: () => ({ value: "cookie-token" }) });
});
describe("mobile AI request authentication", () => {
  it("accepts a verified bearer access token", async () => {
    const payload = { user_id: "user", token_type: "access" };
    mocked.verify.mockResolvedValue(payload);
    expect(
      await getServerCurrentUser(
        new Request("http://local/ai/hint", {
          headers: { Authorization: "Bearer jwt.mobile.token" },
        }),
      ),
    ).toEqual(payload);
    expect(mocked.verify).toHaveBeenCalledWith("jwt.mobile.token");
    expect(mocked.cookies).not.toHaveBeenCalled();
  });
  it("does not accept refresh tokens or fall back to cookies on invalid bearer auth", async () => {
    mocked.verify.mockResolvedValue({ token_type: "refresh" });
    expect(
      await getServerCurrentUser(
        new Request("http://local", {
          headers: { Authorization: "Bearer jwt.refresh.token" },
        }),
      ),
    ).toBeNull();
    expect(mocked.cookies).not.toHaveBeenCalled();
  });
  it("preserves existing browser cookie auth", async () => {
    mocked.verify.mockResolvedValue({ user_id: "browser" });
    expect(await getServerCurrentUser()).toEqual({ user_id: "browser" });
    expect(mocked.verify).toHaveBeenCalledWith("cookie-token");
  });
});

describe("OAuth AI authentication", () => {
  it("asks the backend to validate the token and AI scope", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ user_id: "oauth-user", token_type: "access" }),
      );
    try {
      expect(
        await getServerCurrentUser(
          new Request("http://local/ai/chat", {
            headers: { Authorization: "Bearer opaque-token" },
          }),
        ),
      ).toMatchObject({ user_id: "oauth-user" });
      expect(fetch.mock.calls[0][0]).toContain("/oauth/identity/");
      expect(fetch.mock.calls[0][1]).toMatchObject({
        cache: "no-store",
        headers: { Authorization: "Bearer opaque-token" },
      });
      expect(mocked.cookies).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it("does not use web cookies when OAuth scope is denied", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 403 }));
    try {
      expect(
        await getServerCurrentUser(
          new Request("http://local", {
            headers: { Authorization: "Bearer denied" },
          }),
        ),
      ).toBeNull();
      expect(mocked.cookies).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});

it("does not allow an embedded read-only cookie to call AI", async () => {
  mocked.verify.mockResolvedValue({
    user_id: "embedded",
    token_type: "access",
    mobile_embed: true,
  });
  expect(
    await getServerCurrentUser(new Request("http://local/ai/chat")),
  ).toBeNull();
});
