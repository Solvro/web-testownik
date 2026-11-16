import { afterEach, expect, it, vi } from "vitest";
import {
  withAccountDataLock,
  withOfflineDataLock,
  withQuizCreateLock,
} from "../src/lib/account-data-lock";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("acquires the offline lock before a distinct account-data leaf lock", async () => {
  const names: string[] = [];
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        name: string,
        _options: LockOptions,
        run: () => Promise<unknown>,
      ) => {
        names.push(name);
        try {
          return await run();
        } finally {
          names.push(`release:${name}`);
        }
      },
    },
  });
  await expect(
    withOfflineDataLock(() => withAccountDataLock(async () => "saved")),
  ).resolves.toBe("saved");
  expect(names).toEqual([
    "testownik.offline-data.v1",
    "testownik.account-data.v1",
    "release:testownik.account-data.v1",
    "release:testownik.offline-data.v1",
  ]);
});

it("cancels only outer lock acquisition and leaves the callback untouched", async () => {
  vi.useFakeTimers();
  const run = vi.fn();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, options: LockOptions) =>
        new Promise((_resolve, reject) =>
          options.signal?.addEventListener("abort", () =>
            reject(new Error("Aborted")),
          ),
        ),
    },
  });
  const rejected = expect(withOfflineDataLock(run)).rejects.toMatchObject({
    code: "browserStorageCoordination",
  });
  await vi.advanceTimersByTimeAsync(8000);
  await rejected;
  expect(run).not.toHaveBeenCalled();
});

it("preserves a granted outer transaction's exact storage failure", async () => {
  const failure = new Error("Storage full");
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: LockOptions,
        run: () => Promise<unknown>,
      ) => run(),
    },
  });
  await expect(
    withOfflineDataLock(async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
});

it("gives readable capability failure when secure browser locks are unavailable", async () => {
  vi.stubGlobal("navigator", {});
  await expect(
    withAccountDataLock(async () => undefined),
  ).rejects.toMatchObject({ code: "browserStorageLock" });
});
it("cancels acquisition without running a queued stale callback", async () => {
  vi.useFakeTimers();
  const run = vi.fn();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, options: LockOptions) =>
        new Promise((_resolve, reject) =>
          options.signal?.addEventListener("abort", () =>
            reject(new Error("Aborted")),
          ),
        ),
    },
  });
  const request = withAccountDataLock(run),
    rejected = expect(request).rejects.toMatchObject({
      code: "browserStorageCoordination",
    });
  await vi.advanceTimersByTimeAsync(8000);
  await rejected;
  expect(run).not.toHaveBeenCalled();
});
it("keeps a granted lock until the storage callback actually settles", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
      release = resolve;
    }),
    unlocked = vi.fn();
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: LockOptions,
        run: () => Promise<void>,
      ) => {
        await run();
        unlocked();
      },
    },
  });
  const operation = withAccountDataLock(() => held);
  await vi.advanceTimersByTimeAsync(16000);
  expect(unlocked).not.toHaveBeenCalled();
  release();
  await operation;
  expect(unlocked).toHaveBeenCalledOnce();
});

it("uses short owner-specific create locks before the account-data leaf", async () => {
  const names: string[] = [];
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        name: string,
        _options: LockOptions,
        run: () => Promise<unknown>,
      ) => {
        names.push(name);
        try {
          return await run();
        } finally {
          names.push(`release:${name}`);
        }
      },
    },
  });
  await withQuizCreateLock("owner-A", () =>
    withAccountDataLock(async () => undefined),
  );
  await withQuizCreateLock("owner-B", async () => undefined);
  expect(names).toEqual([
    "testownik.quiz-create.v1.owner-A",
    "testownik.account-data.v1",
    "release:testownik.account-data.v1",
    "release:testownik.quiz-create.v1.owner-A",
    "testownik.quiz-create.v1.owner-B",
    "release:testownik.quiz-create.v1.owner-B",
  ]);
});
it("fails closed when a create lock is held beyond its acquisition deadline", async () => {
  vi.useFakeTimers();
  const run = vi.fn();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, options: LockOptions) =>
        new Promise((_resolve, reject) =>
          options.signal?.addEventListener("abort", () =>
            reject(new Error("Aborted")),
          ),
        ),
    },
  });
  const failed = expect(withQuizCreateLock("owner", run)).rejects.toMatchObject(
    { code: "browserStorageCoordination" },
  );
  await vi.advanceTimersByTimeAsync(8000);
  await failed;
  expect(run).not.toHaveBeenCalled();
});
