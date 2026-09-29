import { describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError, type Tokens } from "../src/lib/client";

function store() {
  let value: Tokens | null = { access: "expired", refresh: "original" };
  return {
    get: async () => value,
    set: async (v: Tokens | null) => {
      value = v;
    },
  };
}
describe("native API authentication", () => {
  it.each([null, [], "proxy failure", 123])(
    "retains a forbidden status even when the error body is malformed: %j",
    async (body) => {
      const api = new ApiClient("http://fixture.invalid", store(), async () =>
        Response.json(body, { status: 403 }),
      );
      await expect(api.request("protected-quiz/")).rejects.toMatchObject({
        status: 403,
        code: "operation",
      });
    },
  );
  it.each([
    null,
    { access_token: {}, refresh_token: "r", token_type: "Bearer" },
    { access_token: "a", refresh_token: "r", token_type: 7 },
    { access_token: "a", token_type: "Bearer" },
  ])("does not persist a malformed refresh response: %j", async (body) => {
    const tokens = store();
    const before = await tokens.get();
    const api = new ApiClient("http://fixture.invalid", tokens, async () =>
      Response.json(body),
    );
    await expect(api.refresh()).rejects.toMatchObject({
      status: 401,
      code: "oauthResponse",
    });
    expect(await tokens.get()).toEqual(before);
  });
  it("refreshes concurrent unauthorized requests only once", async () => {
    const tokens = store();
    let refreshes = 0;
    const fetcher = vi.fn(async (url: any, options: any) => {
      if (String(url).endsWith("/oauth/token/")) {
        expect(new Headers(options.headers).get("Content-Type")).toBe(
          "application/x-www-form-urlencoded",
        );
        expect(new URLSearchParams(options.body).get("grant_type")).toBe(
          "refresh_token",
        );
        expect(new URLSearchParams(options.body).get("client_id")).toBe(
          "testownik-mobile",
        );
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return Response.json({
          access_token: "new",
          refresh_token: "rotated",
          token_type: "Bearer",
        });
      }
      return new Headers(options.headers).get("Authorization") === "Bearer new"
        ? Response.json({ ok: true })
        : Response.json({}, { status: 401 });
    });
    const api = new ApiClient("http://local/api", tokens, fetcher);
    await Promise.all([api.request("a/"), api.request("b/")]);
    expect(refreshes).toBe(1);
    expect((await tokens.get())?.refresh).toBe("rotated");
  });
  it("does not clear a session on temporary refresh failure", async () => {
    const tokens = store();
    const api = new ApiClient("http://local", tokens, async () =>
      Response.json({}, { status: 503 }),
    );
    await expect(api.refresh()).rejects.toBeInstanceOf(ApiError);
    expect(await tokens.get()).not.toBeNull();
  });
  it("cannot resurrect a session after logout", async () => {
    const tokens = store();
    const api = new ApiClient("http://local", tokens, async () => {
      await tokens.set(null);
      return Response.json({
        access_token: "new",
        refresh_token: "rotated",
        token_type: "Bearer",
      });
    });
    await expect(api.refresh()).rejects.toThrow("zakończona");
    expect(await tokens.get()).toBeNull();
  });
  it("does not attach a token to public login", async () => {
    const tokens = store();
    const fetcher = vi.fn(async (_u: any, o: any) => {
      expect(new Headers(o.headers).has("Authorization")).toBe(false);
      return Response.json({ ok: true });
    });
    await new ApiClient("http://local", tokens, fetcher).post(
      "login/",
      {},
      false,
    );
  });
  it("turns maintenance and throttling into actionable errors", async () => {
    const api = new ApiClient("http://local", store(), async () =>
      Response.json({}, { status: 429 }),
    );
    await expect(api.request("a/")).rejects.toThrow("Odczekaj");
  });
});

it("shares refresh rotation across the Django and AI clients", async () => {
  const tokens = store();
  const fetcher = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return Response.json({
      access_token: "new",
      refresh_token: "rotated",
      token_type: "Bearer",
    });
  });
  const django = new ApiClient("http://api", tokens, fetcher);
  const ai = new ApiClient("http://web", tokens, fetcher, "http://api");
  await Promise.all([django.refresh(), ai.refresh()]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("a stale failed refresh cannot log out a newly signed-in account", async () => {
  const tokens = store();
  const api = new ApiClient("http://api", tokens, async () => {
    await tokens.set({ access: "other", refresh: "other-refresh" });
    return Response.json({}, { status: 401 });
  });
  await expect(api.refresh()).rejects.toThrow();
  expect((await tokens.get())?.access).toBe("other");
});
it("invokes the default browser fetch with the global receiver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = function () {
    expect(this).toBe(globalThis);
    return Promise.resolve(Response.json({ ok: true }));
  };
  try {
    await new ApiClient("http://api", store()).request("user/");
  } finally {
    globalThis.fetch = original;
  }
});

it("clears a revoked OAuth refresh grant", async () => {
  const tokens = store();
  const api = new ApiClient("http://local", tokens, async () =>
    Response.json({ error: "invalid_grant" }, { status: 400 }),
  );
  await expect(api.refresh()).rejects.toThrow();
  expect(await tokens.get()).toBeNull();
});
it("preserves form encoding when exchanging an OAuth code", async () => {
  const fetcher = vi.fn(async (_url: any, options: any) => {
    expect(new Headers(options.headers).get("Content-Type")).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(new Headers(options.headers).has("Authorization")).toBe(false);
    return Response.json({ ok: true });
  });
  await new ApiClient("http://local", store(), fetcher).request(
    "oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code",
    },
    false,
  );
});
