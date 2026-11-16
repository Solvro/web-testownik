import { beforeEach, expect, it, vi } from "vitest";
import { CHUNK_MARKER, CHUNK_PREFIX } from "../src/lib/android-chunk-storage";

const state = vi.hoisted(() => ({
  values: new Map<string, string>(),
  failWrite: false,
  nativeWriteError: null as unknown,
  events: [] as string[],
  recoverAfterRemove: false,
  externalMarkers: new Set<string>(),
  failExternalMarker: false,
  gateKey: "",
  gate: null as Promise<void> | null,
  started: null as (() => void) | null,
}));
vi.mock("../src/lib/deletion-markers", () => ({
  externalDeletionMarkers: {
    list: async () => [...state.externalMarkers],
    write: async (owner: string) => {
      if (state.failExternalMarker) throw new Error("Device disk is full");
      state.externalMarkers.add(owner);
      state.events.push(`marker:${owner}`);
    },
    remove: async (owner: string) => {
      state.externalMarkers.delete(owner);
    },
  },
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-crypto", async () => {
  const { createHash } = await import("node:crypto");
  return {
    CryptoDigestAlgorithm: { SHA256: "sha256" },
    digestStringAsync: async (_algorithm: string, value: string) =>
      createHash("sha256").update(value).digest("hex"),
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getAllKeys: async () => [...state.values.keys()],
    getItem: async (key: string) => state.values.get(key) ?? null,
    multiGet: async (keys: readonly string[]) =>
      keys.map((key) => [key, state.values.get(key) ?? null]),
    multiSet: async (pairs: readonly (readonly [string, string])[]) => {
      if (state.gate && pairs.some(([key]) => key === state.gateKey)) {
        state.started?.();
        await state.gate;
      }
      if (state.nativeWriteError) throw state.nativeWriteError;
      if (state.failWrite)
        throw [{ message: "SQLITE_FULL: database or disk is full" }];
      const next = new Map(state.values);
      for (const [key, value] of pairs) next.set(key, value);
      state.values = next;
    },
    multiRemove: async (keys: readonly string[]) => {
      state.events.push("erase");
      for (const key of keys) state.values.delete(key);
      if (state.recoverAfterRemove) state.failWrite = false;
    },
  },
}));
beforeEach(() => {
  vi.resetModules();
  state.values.clear();
  state.externalMarkers.clear();
  state.failExternalMarker = false;
  state.failWrite = false;
  state.nativeWriteError = null;
  state.events.length = 0;
  state.recoverAfterRemove = false;
  state.gateKey = "";
  state.gate = null;
  state.started = null;
});

it("persists and reads a large Unicode bank through the actual Android storage facade", async () => {
  const { storage } = await import("../src/lib/storage");
  const bank = { queue: [{ text: "Zażółć 🌱 ".repeat(180_000) }] };
  await storage.write("offline.large-owner", bank);
  expect(state.values.get("testownik.v1.offline.large-owner")).toMatch(
    new RegExp(`^${CHUNK_MARKER}`),
  );
  expect(await storage.readStrict("offline.large-owner", null)).toEqual(bank);
  expect(await storage.keys()).toEqual(["offline.large-owner"]);
});

it("a failed replacement keeps the previously saved answer bank readable", async () => {
  const { storage } = await import("../src/lib/storage");
  const previous = { queue: ["preserved"], text: "x".repeat(1_200_000) };
  await storage.write("offline.full-owner", previous);
  const before = [...state.values];
  state.failWrite = true;
  await expect(
    storage.write("offline.full-owner", { ...previous, queue: [] }),
  ).rejects.toMatchObject({ code: "storageFull" });
  expect([...state.values]).toEqual(before);
  expect(await storage.readStrict("offline.full-owner", null)).toEqual(
    previous,
  );
});

it("account purge waits for a late chunked write and blocks later create journals", async () => {
  const { storage } = await import("../src/lib/storage");
  const owner = "deleted-android-owner";
  state.gateKey = `testownik.v1.offline.${owner}`;
  let release!: () => void;
  state.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    state.started = resolve;
  });
  const writing = storage.write(`offline.${owner}`, {
    text: "x".repeat(1_200_000),
    queue: ["late"],
  });
  await started;
  const deleting = storage.purgeDeletedAccount(owner);
  release();
  await Promise.all([writing, deleting]);
  await storage.write(`quiz-create.${owner}.new`, { request_id: "late" });
  await storage.write(`draft.${owner}.new`, { title: "late" });
  expect(await storage.keys()).toEqual([`account-deletion.${owner}`]);
  expect(
    [...state.values.keys()].some((key) => key.startsWith(CHUNK_PREFIX)),
  ).toBe(false);
});

it("owner purge discovers headerless chunks while retaining another owner's chunks", async () => {
  const { storage } = await import("../src/lib/storage");
  const orphan = `${CHUNK_PREFIX}${encodeURIComponent("testownik.v1.offline.orphan-owner")}:0`;
  state.values.set(orphan, "orphan-private-bytes");
  const another = {
    text: "y".repeat(1_200_000),
    queue: ["another-owner-answer"],
  };
  await storage.write("offline.another-owner", another);
  expect(await storage.keys()).toContain("offline.orphan-owner");
  await storage.purgeDeletedAccount("orphan-owner");
  expect(state.values.has(orphan)).toBe(false);
  expect(await storage.readStrict("offline.another-owner", null)).toEqual(
    another,
  );
});

it("a missing chunk fails closed and leaves every remaining byte untouched", async () => {
  const { storage } = await import("../src/lib/storage");
  await storage.write("offline.damaged-owner", {
    queue: ["answer"],
    text: "z".repeat(1_200_000),
  });
  const chunk = [...state.values.keys()].find((key) =>
    key.startsWith(CHUNK_PREFIX),
  )!;
  state.values.delete(chunk);
  const before = [...state.values];
  await expect(
    storage.readStrict("offline.damaged-owner", { queue: [] }),
  ).rejects.toMatchObject({ code: "localData" });
  expect([...state.values]).toEqual(before);
});

it("a full Android database does not prevent deleted-account cleanup freeing its own space", async () => {
  const { storage } = await import("../src/lib/storage");
  const deleted = {
    quizzes: { private: { id: "private", text: "x".repeat(1_200_000) } },
    queue: [],
    errors: {},
  };
  const retained = { queue: ["other-owner"], text: "y".repeat(1_200_000) };
  await storage.write("offline.full-deleted-owner", deleted);
  await storage.write("offline.retained-owner", retained);
  state.failWrite = true;
  state.recoverAfterRemove = true;
  state.events.length = 0;
  const quizzes = await storage.purgeDeletedAccount("full-deleted-owner");
  expect(state.events[0]).toBe("marker:full-deleted-owner");
  expect(state.events).toContain("erase");
  expect(quizzes).toEqual(Object.values(deleted.quizzes));
  expect(
    await storage.readStrict("offline.full-deleted-owner", null),
  ).toBeNull();
  expect(await storage.readStrict("offline.retained-owner", null)).toEqual(
    retained,
  );
  expect(await storage.isAccountDeletionPending("full-deleted-owner")).toBe(
    true,
  );
  await storage.write("draft.full-deleted-owner.new", { title: "late" });
  expect(
    await storage.readStrict("draft.full-deleted-owner.new", null),
  ).toBeNull();
});

it("does not erase account data if both SQLite and fallback device storage are full", async () => {
  const { storage } = await import("../src/lib/storage");
  await storage.write("offline.full-device-owner", {
    text: "z".repeat(1_200_000),
    queue: ["private"],
  });
  const before = [...state.values];
  state.failWrite = true;
  state.failExternalMarker = true;
  await expect(
    storage.purgeDeletedAccount("full-device-owner"),
  ).rejects.toThrow("Device disk is full");
  expect([...state.values]).toEqual(before);
  expect(state.externalMarkers.size).toBe(0);
});

it("discovers a fallback deletion intent after relaunch and retains it until cleanup completes", async () => {
  state.externalMarkers.add("relaunch-deleted-owner");
  const { storage } = await import("../src/lib/storage");
  expect(await storage.pendingAccountDeletions()).toEqual([
    "relaunch-deleted-owner",
  ]);
  expect(await storage.isAccountDeletionPending("relaunch-deleted-owner")).toBe(
    true,
  );
  await storage.write("draft.relaunch-deleted-owner.new", {
    title: "late after relaunch",
  });
  expect(
    await storage.readStrict("draft.relaunch-deleted-owner.new", null),
  ).toBeNull();
  await storage.completeAccountDeletion("relaunch-deleted-owner");
  expect(await storage.pendingAccountDeletions()).toEqual([]);
});

it("records explicit deletion outside SQLite after a generic primary failure before erasing only its owner", async () => {
  const { storage } = await import("../src/lib/storage");
  await storage.write("offline.failed-owner", { queue: ["private answer"] });
  await storage.write("draft.retained-owner.new", {
    title: "Other owner exact bytes",
  });
  const retained = state.values.get("testownik.v1.draft.retained-owner.new");
  state.nativeWriteError = [{ message: "malformed database" }];
  await storage.purgeDeletedAccount("failed-owner");
  expect(state.externalMarkers.has("failed-owner")).toBe(true);
  expect(state.events.indexOf("marker:failed-owner")).toBeLessThan(
    state.events.indexOf("erase"),
  );
  expect(await storage.readStrict("offline.failed-owner", null)).toBeNull();
  expect(state.values.get("testownik.v1.draft.retained-owner.new")).toBe(
    retained,
  );
});
