import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  platform: { OS: "web" },
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: mocks.getItemAsync,
  setItemAsync: mocks.setItemAsync,
  deleteItemAsync: mocks.deleteItemAsync,
}));
vi.mock("../src/lib/api", () => ({ api: { request: mocks.request } }));

beforeEach(() => {
  vi.resetModules();
  mocks.request.mockReset();
  mocks.platform.OS = "web";
  mocks.getItemAsync.mockReset();
  mocks.setItemAsync.mockReset();
  mocks.deleteItemAsync.mockReset();
  const items = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

const response = {
  access_token: "synthetic-oauth-access",
  refresh_token: "synthetic-oauth-refresh",
  token_type: "Bearer",
};

it("a consumed callback cannot return cached credentials after the login flow is cleared", async () => {
  const { saveOAuth, exchangeOAuth } = await import("../src/lib/oauth");
  await saveOAuth({ verifier: "synthetic-verifier", state: "synthetic-state" });
  mocks.request.mockResolvedValue(response);
  await expect(
    exchangeOAuth({ code: "consumed-code", state: "synthetic-state" }),
  ).resolves.toEqual({
    access: response.access_token,
    refresh: response.refresh_token,
  });
  await saveOAuth(null);
  await expect(
    exchangeOAuth({ code: "consumed-code", state: "synthetic-state" }),
  ).rejects.toMatchObject({ code: "oauthState" });
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it("simultaneous callback consumers share the one pending exchange", async () => {
  const { saveOAuth, exchangeOAuth } = await import("../src/lib/oauth");
  await saveOAuth({ verifier: "synthetic-verifier", state: "synthetic-state" });
  let resolve!: (value: typeof response) => void;
  mocks.request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const first = exchangeOAuth({
    code: "inflight-code",
    state: "synthetic-state",
  });
  const second = exchangeOAuth({
    code: "inflight-code",
    state: "synthetic-state",
  });
  expect(second).toBe(first);
  await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
  resolve(response);
  await expect(first).resolves.toMatchObject({ access: response.access_token });
  await expect(second).resolves.toMatchObject({
    access: response.access_token,
  });
});

it("a late exchange cannot clear a newer sign-in flow or return stale credentials", async () => {
  const { saveOAuth, exchangeOAuth } = await import("../src/lib/oauth");
  await saveOAuth({ verifier: "first-verifier", state: "first-state" });
  let resolve!: (value: typeof response) => void;
  mocks.request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const old = exchangeOAuth({ code: "old-code", state: "first-state" });
  await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
  await saveOAuth({ verifier: "new-verifier", state: "new-state" });
  const rejected = expect(old).rejects.toMatchObject({ code: "oauthState" });
  resolve(response);
  await rejected;
  expect(
    JSON.parse(sessionStorage.getItem("testownik.oauth.v1") ?? "null"),
  ).toEqual({
    verifier: "new-verifier",
    state: "new-state",
  });
});

it("an old browser cancellation preserves the newer flow", async () => {
  const { saveOAuth, clearOAuth, exchangeOAuth } =
    await import("../src/lib/oauth");
  const old = { verifier: "old-verifier", state: "old-state" };
  const current = { verifier: "current-verifier", state: "current-state" };
  await saveOAuth(old);
  await saveOAuth(current);
  await expect(clearOAuth(old)).resolves.toBe(false);
  mocks.request.mockResolvedValue(response);
  await expect(
    exchangeOAuth({ code: "current-code", state: current.state }),
  ).resolves.toMatchObject({ access: response.access_token });
});

it("canceling the matching flow prevents its pending exchange from signing in", async () => {
  const { saveOAuth, clearOAuth, exchangeOAuth } =
    await import("../src/lib/oauth");
  const flow = { verifier: "verifier", state: "state" };
  await saveOAuth(flow);
  let resolve!: (value: typeof response) => void;
  mocks.request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = exchangeOAuth({ code: "cancelled-code", state: flow.state });
  const rejected = expect(pending).rejects.toMatchObject({
    code: "oauthState",
  });
  await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
  await expect(clearOAuth(flow)).resolves.toBe(true);
  resolve(response);
  await rejected;
});

it("a failed exchange can be retried while its own PKCE flow remains valid", async () => {
  const { saveOAuth, exchangeOAuth } = await import("../src/lib/oauth");
  await saveOAuth({ verifier: "verifier", state: "state" });
  mocks.request
    .mockRejectedValueOnce(new Error("synthetic transport failure"))
    .mockResolvedValueOnce(response);
  await expect(
    exchangeOAuth({ code: "retry-code", state: "state" }),
  ).rejects.toThrow("synthetic transport failure");
  await expect(
    exchangeOAuth({ code: "retry-code", state: "state" }),
  ).resolves.toMatchObject({ access: response.access_token });
  expect(mocks.request).toHaveBeenCalledTimes(2);
});

it("native clear and newer save remain ordered when SecureStore removal is delayed", async () => {
  mocks.platform.OS = "ios";
  let stored: string | null = null;
  mocks.getItemAsync.mockImplementation(async () => stored);
  mocks.setItemAsync.mockImplementation(async (_key: string, value: string) => {
    stored = value;
  });
  let finishRemoval!: () => void;
  mocks.deleteItemAsync.mockImplementation(
    () =>
      new Promise<void>((done) => {
        finishRemoval = () => {
          stored = null;
          done();
        };
      }),
  );
  const { saveOAuth, clearOAuth } = await import("../src/lib/oauth");
  const old = { verifier: "old-verifier", state: "old-state" };
  const current = { verifier: "current-verifier", state: "current-state" };
  await saveOAuth(old);
  const removal = clearOAuth(old);
  await vi.waitFor(() =>
    expect(mocks.deleteItemAsync).toHaveBeenCalledTimes(1),
  );
  const saving = saveOAuth(current);
  finishRemoval();
  await expect(removal).resolves.toBe(false);
  await saving;
  expect(JSON.parse(stored!)).toEqual(current);
});

it("a failed storage operation does not block a later login flow", async () => {
  mocks.platform.OS = "ios";
  mocks.setItemAsync
    .mockRejectedValueOnce(new Error("storage unavailable"))
    .mockResolvedValueOnce(undefined);
  const { saveOAuth } = await import("../src/lib/oauth");
  await expect(
    saveOAuth({ verifier: "old-verifier", state: "old-state" }),
  ).rejects.toThrow("storage unavailable");
  await expect(
    saveOAuth({ verifier: "new-verifier", state: "new-state" }),
  ).resolves.toBeUndefined();
  expect(mocks.setItemAsync).toHaveBeenCalledTimes(2);
});

it("an older evicted exchange settling cannot remove a newer promise for that callback", async () => {
  const { saveOAuth, exchangeOAuth } = await import("../src/lib/oauth");
  await saveOAuth({ verifier: "verifier", state: "state" });
  const requests: {
    resolve: (value: typeof response) => void;
    reject: (error: Error) => void;
  }[] = [];
  mocks.request.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        requests.push({ resolve, reject });
      }),
  );
  const pending = Array.from({ length: 6 }, (_, index) =>
    exchangeOAuth({ code: `code-${index}`, state: "state" }),
  );
  const all = Promise.allSettled(pending);
  await vi.waitFor(() => expect(requests).toHaveLength(6));
  const replacement = exchangeOAuth({ code: "code-0", state: "state" });
  const replacementResult = Promise.allSettled([replacement]);
  await vi.waitFor(() => expect(requests).toHaveLength(7));
  requests[0].reject(new Error("old request failed"));
  await expect(pending[0]).rejects.toThrow("old request failed");
  expect(exchangeOAuth({ code: "code-0", state: "state" })).toBe(replacement);
  for (const request of requests.slice(1))
    request.reject(new Error("test cleanup"));
  await all;
  await replacementResult;
  expect(mocks.request).toHaveBeenCalledTimes(7);
});

it("a newer login started while owned cleanup resolves wins before the exchange returns", async () => {
  mocks.platform.OS = "ios";
  let stored: string | null = null;
  const current = { verifier: "current-verifier", state: "current-state" };
  mocks.getItemAsync.mockImplementation(async () => stored);
  mocks.setItemAsync.mockImplementation(async (_key: string, value: string) => {
    stored = value;
  });
  const { saveOAuth, exchangeOAuth } = await import("../src/lib/oauth");
  let saving: Promise<void> | undefined;
  mocks.deleteItemAsync.mockImplementation(async () => {
    stored = null;
    // Allow clearOAuth's own final check to finish, then supersede the flow
    // while the exchange awaits its queued cleanup result.
    queueMicrotask(() =>
      queueMicrotask(() =>
        queueMicrotask(() => {
          saving = saveOAuth(current);
        }),
      ),
    );
  });
  mocks.request.mockResolvedValue(response);
  await saveOAuth({ verifier: "old-verifier", state: "old-state" });
  await expect(
    exchangeOAuth({ code: "code", state: "old-state" }),
  ).rejects.toMatchObject({ code: "oauthState" });
  await saving;
  expect(JSON.parse(stored!)).toEqual(current);
});

it("native storage cleanup failure never delivers minted credentials or clears a newer flow", async () => {
  mocks.platform.OS = "ios";
  let stored: string | null = null;
  mocks.getItemAsync.mockImplementation(async () => stored);
  mocks.setItemAsync.mockImplementation(async (_key: string, value: string) => {
    stored = value;
  });
  mocks.deleteItemAsync.mockRejectedValue(
    new Error("synthetic secure storage failure"),
  );
  const { saveOAuth, exchangeOAuth } = await import("../src/lib/oauth");
  const flow = { verifier: "verifier", state: "state" };
  await saveOAuth(flow);
  mocks.request.mockResolvedValue(response);
  await expect(exchangeOAuth({ code: "code", state: "state" })).rejects.toThrow(
    "synthetic secure storage failure",
  );
  expect(JSON.parse(stored!)).toEqual(flow);
  await saveOAuth({ verifier: "new-verifier", state: "new-state" });
  expect(JSON.parse(stored!)).toEqual({
    verifier: "new-verifier",
    state: "new-state",
  });
});
