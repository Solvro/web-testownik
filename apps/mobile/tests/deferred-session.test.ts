import { expect, it, vi } from "vitest";

import { ApiClient } from "../src/lib/client";
import { createTokenStore } from "../src/lib/token-store";

it.each(["quizzes/fixture/", "quizzes/fixture/?include=current_session"])(
  "a deferred cache lookup cannot fetch %s under the next account",
  async (path) => {
    const store = createTokenStore({
      read: async () => null,
      write: async () => {},
    });
    await store.set({ access: "A", refresh: "A-refresh" });
    const fetcher = vi.fn();
    const api = new ApiClient("https://fixture.invalid/api", store, fetcher);
    const client = api.forSession();
    let finishRead!: () => void;
    const read = new Promise<void>((resolve) => {
      finishRead = resolve;
    });
    // Both search and history read offline storage before fetching live data.
    const work = (async () => {
      await read;
      return client.request(path);
    })();
    const rejected = expect(work).rejects.toMatchObject({ code: "signedOut" });
    await store.set({ access: "B", refresh: "B-refresh" });
    finishRead();
    await rejected;
    expect(fetcher).not.toHaveBeenCalled();
    expect((await store.get())?.access).toBe("B");
  },
);

it("re-reads secure credentials after failed sign-out while keeping old work aborted", async () => {
  const saved = { access: "A", refresh: "A-refresh" };
  const read = vi.fn(async () => saved);
  const write = vi
    .fn()
    .mockRejectedValueOnce(new Error("Keychain unavailable"));
  const store = createTokenStore({ read, write });
  expect(await store.get()).toEqual(saved);
  const oldSession = store.session();
  await expect(store.set(null)).rejects.toThrow("Keychain unavailable");
  expect(oldSession.aborted).toBe(true);
  expect(await store.get()).toEqual(saved);
  expect(read).toHaveBeenCalledTimes(2);
  await store.set(null);
  expect(await store.get()).toBeNull();
});

it("failed old credential cleanup cannot reset a newer account's cached tokens", async () => {
  let rejectWrite!: (error: Error) => void;
  const write = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          rejectWrite = reject;
        }),
    )
    .mockResolvedValue(undefined);
  const store = createTokenStore({ read: async () => null, write });
  const clearing = store.set(null);
  const failed = expect(clearing).rejects.toThrow("Old cleanup failed");
  await Promise.resolve();
  const login = store.set({ access: "B", refresh: "B-refresh" });
  rejectWrite(new Error("Old cleanup failed"));
  await failed;
  await login;
  expect(await store.get()).toEqual({ access: "B", refresh: "B-refresh" });
});

it("re-reads persisted credentials after a failed replacement login", async () => {
  const original = { access: "A", refresh: "A-refresh" };
  const store = createTokenStore({
    read: async () => original,
    write: async () => {
      throw new Error("Secure storage unavailable");
    },
  });
  expect(await store.get()).toEqual(original);
  const oldSession = store.session();
  await expect(
    store.set({ access: "B", refresh: "B-refresh" }),
  ).rejects.toThrow("Secure storage unavailable");
  expect(oldSession.aborted).toBe(true);
  expect(await store.get()).toEqual(original);
});
