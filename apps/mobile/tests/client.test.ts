import { describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError, type Tokens } from "../src/lib/client";
import { createTokenStore } from "../src/lib/token-store";

function store() {
  let value: Tokens | null = { access: "expired", refresh: "original" };
  return createTokenStore({
    read: async () => value,
    write: async (v: Tokens | null) => {
      value = v;
    },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("keeps a deadline when a query supplies its own cancellation signal", async () => {
  const deadline = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(deadline.signal);
  const started = deferred<void>();
  const api = new ApiClient("http://api", store(), async (_url, options) => {
    started.resolve();
    return new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () =>
        reject(options!.signal!.reason),
      );
    });
  });
  try {
    const pending = api.request("user/", {
      signal: new AbortController().signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await started.promise;
    expect(timeout).toHaveBeenCalledWith(30000);
    deadline.abort(new DOMException("Timed out", "TimeoutError"));
    await rejected;
  } finally {
    timeout.mockRestore();
  }
});

it.each(["caller", "session", "deadline"])(
  "cancels a stalled response body after headers on %s abort",
  async (source) => {
    const tokens = store();
    const caller = new AbortController();
    const deadline = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    const reading = deferred<void>();
    let fetchSignal: AbortSignal | null | undefined;
    const api = new ApiClient("http://api", tokens, async (_url, options) => {
      fetchSignal = options?.signal;
      const response = Response.json({});
      response.json = () =>
        new Promise((_resolve, reject) => {
          reading.resolve();
          // React Native fetch can discard the AbortSignal's original reason.
          fetchSignal!.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      return response;
    });
    try {
      const pending = api.request("user/", { signal: caller.signal });
      const rejected =
        source === "caller"
          ? expect(pending).rejects.toMatchObject({ name: "AbortError" })
          : expect(pending).rejects.toMatchObject({
              code: source === "session" ? "signedOut" : "timeout",
            });
      await reading.promise;
      if (source === "caller") caller.abort();
      else if (source === "session") await tokens.set(null);
      else deadline.abort(new DOMException("Timed out", "TimeoutError"));
      expect(fetchSignal?.aborted).toBe(true);
      await rejected;
    } finally {
      timeout.mockRestore();
    }
  },
);

it.each([
  [{ body: new FormData(), method: "POST" }, 120000],
  [{ timeoutMs: 90000 }, 90000],
] as const)(
  "applies an upload or explicit deadline without passing custom options to fetch",
  async (options, expected) => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const api = new ApiClient("http://api", store(), async (_url, init) => {
      expect(init).not.toHaveProperty("timeoutMs");
      return Response.json({ ok: true });
    });
    try {
      await expect(api.request("upload/", options)).resolves.toEqual({
        ok: true,
      });
      expect(timeout).toHaveBeenCalledWith(expected);
    } finally {
      timeout.mockRestore();
    }
  },
);

it("normalizes a refresh timeout and retains credentials for retry", async () => {
  const tokens = store();
  const deadline = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(deadline.signal);
  const started = deferred<void>();
  const api = new ApiClient("http://api", tokens, async (_url, options) => {
    started.resolve();
    return new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () =>
        reject(new TypeError("Cancelled")),
      );
    });
  });
  try {
    const pending = api.refresh();
    const rejected = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await started.promise;
    expect(timeout).toHaveBeenCalledWith(20000);
    deadline.abort(new DOMException("Timed out", "TimeoutError"));
    await rejected;
    expect(await tokens.get()).not.toBeNull();
  } finally {
    timeout.mockRestore();
  }
});

it("never retries a late account-A mutation using account B's credentials", async () => {
  const tokens = store();
  const sent = deferred<void>();
  const reply = deferred<Response>();
  const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) => {
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer expired",
    );
    sent.resolve();
    return reply.promise;
  });
  const api = new ApiClient("http://api", tokens, fetcher);
  const result = api.patch("user/", { hide_profile: true });
  const rejected = expect(result).rejects.toMatchObject({ code: "signedOut" });
  await sent.promise;
  await tokens.set({ access: "B", refresh: "B-refresh" });
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  reply.resolve(Response.json({}, { status: 401 }));
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await tokens.get())?.access).toBe("B");
});

it("reuses a sibling's rotated credentials for a late 401 in the same session", async () => {
  const tokens = store();
  const sent = deferred<void>();
  const reply = deferred<Response>();
  const fetcher = vi.fn(async (url: unknown, options?: RequestInit) => {
    if (String(url).endsWith("oauth/token/"))
      return Response.json({
        access_token: "rotated",
        refresh_token: "rotated-refresh",
        token_type: "Bearer",
      });
    if (new Headers(options?.headers).get("Authorization") === "Bearer rotated")
      return Response.json({ ok: true });
    sent.resolve();
    return reply.promise;
  });
  const api = new ApiClient("http://api", tokens, fetcher);
  const result = api.request("user/");
  await sent.promise;
  await api.refresh();
  reply.resolve(Response.json({}, { status: 401 }));
  await expect(result).resolves.toEqual({ ok: true });
  expect(
    fetcher.mock.calls.filter(([url]) => String(url).endsWith("oauth/token/")),
  ).toHaveLength(1);
});

it("a new account does not join a refresh belonging to an ended session", async () => {
  const tokens = store();
  const started = deferred<void>();
  const reply = deferred<Response>();
  const api = new ApiClient("http://api", tokens, async (_url, options) => {
    if (
      new URLSearchParams(String(options?.body)).get("refresh_token") ===
      "original"
    ) {
      started.resolve();
      return reply.promise;
    }
    return Response.json({
      access_token: "B-new",
      refresh_token: "B-next",
      token_type: "Bearer",
    });
  });
  const original = api.refresh();
  const rejected = expect(original).rejects.toMatchObject({
    code: "signedOut",
  });
  await started.promise;
  await tokens.set({ access: "B", refresh: "B-refresh" });
  await expect(api.refresh()).resolves.toMatchObject({ access: "B-new" });
  reply.resolve(
    Response.json({
      access_token: "A-new",
      refresh_token: "A-next",
      token_type: "Bearer",
    }),
  );
  await rejected;
  expect((await tokens.get())?.access).toBe("B-new");
});

it("a client retained by old background work cannot start requests in the next session", async () => {
  const tokens = store();
  const fetcher = vi.fn();
  const original = new ApiClient("http://api", tokens, fetcher).forSession();
  await tokens.set({ access: "B", refresh: "B-refresh" });
  await expect(original.post("answer/", {})).rejects.toMatchObject({
    code: "signedOut",
  });
  expect(fetcher).not.toHaveBeenCalled();
});

it("preserves the caller's abort reason", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Timed out", "TimeoutError");
  controller.abort(reason);
  const api = new ApiClient("http://api", store(), async (_url, options) => {
    throw options?.signal?.reason;
  });
  await expect(
    api.request("user/", { signal: controller.signal }),
  ).rejects.toBe(reason);
});

it("serializes secure-storage writes so an old refresh cannot overwrite a new login", async () => {
  const started = deferred<void>();
  const finish = deferred<void>();
  let saved: Tokens | null = null;
  const tokens = createTokenStore({
    read: async () => saved,
    write: async (value) => {
      if (value?.access === "A-rotated") {
        started.resolve();
        await finish.promise;
      }
      saved = value;
    },
  });
  await tokens.set({ access: "A", refresh: "A-refresh" });
  const rotating = tokens.set(
    { access: "A-rotated", refresh: "A-next" },
    tokens.session(),
  );
  const rejected = expect(rotating).rejects.toMatchObject({
    code: "signedOut",
  });
  await started.promise;
  const login = tokens.set({ access: "B", refresh: "B-refresh" });
  finish.resolve();
  await rejected;
  await login;
  expect(saved).toEqual({ access: "B", refresh: "B-refresh" });
  expect(await tokens.get()).toEqual(saved);
});
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
it("rejects a previous account’s slow response body after headers arrived", async () => {
  const tokens = store();
  let finish!: (value: unknown) => void;
  let reading!: () => void;
  const started = new Promise<void>((resolve) => {
    reading = resolve;
  });
  const response = Response.json({ id: "old-account" });
  response.json = vi.fn(() => {
    reading();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const api = new ApiClient("http://api", tokens, async () => response);
  const result = api.request("user/");
  await started;
  await tokens.set({ access: "other", refresh: "other-refresh" });
  finish({ id: "old-account" });
  await expect(result).rejects.toThrow("zakończona");
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

it.each(["caller", "deadline"])(
  "a %s abort releases a request waiting for shared refresh without cancelling its sibling",
  async (source) => {
    const tokens = store();
    const caller = new AbortController();
    const deadline = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation((ms) =>
        ms === 4000 ? deadline.signal : new AbortController().signal,
      );
    const started = deferred<void>();
    const reply = deferred<Response>();
    let refreshCalls = 0;
    let refreshSignal: AbortSignal | null | undefined;
    const api = new ApiClient("http://api", tokens, async (url, options) => {
      if (String(url).endsWith("oauth/token/")) {
        refreshCalls++;
        refreshSignal = options?.signal;
        started.resolve();
        return reply.promise;
      }
      return new Headers(options?.headers).get("Authorization") ===
        "Bearer expired"
        ? Response.json({}, { status: 401 })
        : Response.json({ loaded: true });
    });
    let firstError: unknown;
    const first = api
      .request("first/", { signal: caller.signal, timeoutMs: 4000 })
      .catch((error: unknown) => {
        firstError = error;
      });
    await started.promise;
    const sibling = api.request("sibling/");
    try {
      if (source === "caller") caller.abort();
      else deadline.abort(new DOMException("Timed out", "TimeoutError"));
      await vi.waitFor(
        () =>
          expect(firstError).toMatchObject(
            source === "caller" ? { name: "AbortError" } : { code: "timeout" },
          ),
        { timeout: 500 },
      );
      expect(refreshSignal?.aborted).toBe(false);
    } finally {
      reply.resolve(
        Response.json({
          access_token: "fresh",
          refresh_token: "rotated",
          token_type: "Bearer",
        }),
      );
      await first;
      await expect(sibling).resolves.toEqual({ loaded: true });
      timeout.mockRestore();
    }
    expect(refreshCalls).toBe(1);
    expect(await tokens.get()).toEqual({ access: "fresh", refresh: "rotated" });
  },
);
