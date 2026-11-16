import { beforeEach, expect, it, vi } from "vitest";
import { storage } from "../src/lib/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const state = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getAllKeys: async () => [...state.values.keys()],
    getItem: async (key: string) => state.values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      state.values.set(key, value);
    },
    removeItem: async (key: string) => {
      state.values.delete(key);
    },
  },
}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-crypto", () => ({}));
// Storage facade tests isolate platform I/O; native filesystem and browser IDB
// durability are covered by their own helper tests and browser regressions.
vi.mock("../src/lib/deletion-markers", () => ({
  externalDeletionMarkers: {
    supported: false,
    list: async () => [],
    write: async () => {
      throw new Error("Unsupported test backup");
    },
    remove: async () => {},
  },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
beforeEach(() => state.values.clear());

it("retains the native transaction path without any browser lock capability", async () => {
  vi.stubGlobal("navigator", undefined);
  try {
    await expect(
      storage.withOfflineTransaction(async () => "native saved"),
    ).resolves.toBe("native saved");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("uses the empty offline fallback only when no persisted record exists", async () => {
  const fallback = { quizzes: {}, queue: [], errors: {} };
  expect(await storage.readStrict("offline.account", fallback)).toEqual(
    fallback,
  );
  await storage.write("offline.account", { ...fallback, queue: ["preserved"] });
  expect(await storage.readStrict("offline.account", fallback)).toEqual({
    ...fallback,
    queue: ["preserved"],
  });
});

it("reports damaged JSON while preserving its original bytes", async () => {
  const key = "testownik.v1.offline.account";
  state.values.set(key, '{"queue":[');
  await expect(
    storage.readStrict("offline.account", { queue: [] }),
  ).rejects.toMatchObject({ code: "localData" });
  expect(state.values.get(key)).toBe('{"queue":[');
});

it("reports an empty corrupted record rather than treating it as missing", async () => {
  state.values.set("testownik.v1.offline.account", "");
  await expect(
    storage.readStrict("offline.account", { queue: [] }),
  ).rejects.toMatchObject({ code: "localData" });
});

it("keeps a deletion marker on failure and retries cleanup without restoring owner drafts", async () => {
  const owner = "deletion-retry";
  await storage.write(`draft.${owner}.new`, { title: "Private draft" });
  await storage.write("draft.another.new", { title: "Other account" });
  vi.spyOn(AsyncStorage, "removeItem").mockRejectedValueOnce(
    new Error("Disk unavailable"),
  );
  await expect(storage.purgeDeletedAccount(owner)).rejects.toThrow(
    "Disk unavailable",
  );
  expect(await storage.isAccountDeletionPending(owner)).toBe(true);
  await storage.write(`chat-draft.${owner}.quiz.question`, "Late exit flush");
  expect(
    await storage.read(`chat-draft.${owner}.quiz.question`, null),
  ).toBeNull();
  await storage.purgeDeletedAccount(owner);
  expect(await storage.read(`draft.${owner}.new`, null)).toBeNull();
  expect(await storage.read("draft.another.new", null)).toEqual({
    title: "Other account",
  });
  await storage.completeAccountDeletion(owner);
  expect(await storage.isAccountDeletionPending(owner)).toBe(false);
});

it("waits for an already running owner write before purging its keys", async () => {
  const owner = "deletion-pending-write";
  let finish!: () => void;
  let started!: () => void;
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(AsyncStorage, "setItem").mockImplementationOnce(
    async (key, value) => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      state.values.set(key, value);
    },
  );
  const writing = storage.write(`draft.${owner}.new`, { title: "In flight" });
  await sent;
  const deleting = storage.purgeDeletedAccount(owner);
  finish();
  await writing;
  await deleting;
  expect(await storage.read(`draft.${owner}.new`, null)).toBeNull();
});

it("conditional last-user cleanup preserves a newly cached different account", async () => {
  await storage.write("last-user", { id: "new-account", full_name: "Fixture" });
  await storage.removeLastUser("deleted-account");
  expect(await storage.read("last-user", null)).toEqual({
    id: "new-account",
    full_name: "Fixture",
  });
});

it("enumerates persisted deletion markers independently of tokens and last-user", async () => {
  state.values.set("testownik.v1.account-deletion.first", "true");
  state.values.set("testownik.v1.account-deletion.second", "true");
  state.values.set("another-app.account-deletion.unrelated", "true");
  expect(await storage.pendingAccountDeletions()).toEqual(["first", "second"]);
  await storage.completeAccountDeletion("first");
  expect(await storage.pendingAccountDeletions()).toEqual(["second"]);
});

it("removes the deleted owner's cached profile", async () => {
  await storage.write("last-user", { id: "matching-deleted-profile" });
  await storage.removeLastUser("matching-deleted-profile");
  expect(await storage.read("last-user", null)).toBeNull();
});

for (const value of ["", "{broken"]) {
  it(`removes a damaged cached profile during explicit deletion: ${JSON.stringify(value)}`, async () => {
    state.values.set("testownik.v1.last-user", value);
    await storage.removeLastUser("deleted-corrupt-profile");
    expect(state.values.has("testownik.v1.last-user")).toBe(false);
  });
}

it("blocks a deleted owner's late profile write while preserving a different account", async () => {
  const owner = "deleted-late-profile";
  await storage.purgeDeletedAccount(owner);
  await storage.removeLastUser(owner);
  await storage.write("last-user", { id: owner });
  expect(await storage.read("last-user", null)).toBeNull();
  await storage.write("last-user", { id: "retained-late-profile" });
  expect(await storage.read("last-user", null)).toEqual({
    id: "retained-late-profile",
  });
});

it("does not commit a profile whose account ended while it waited in the storage queue", async () => {
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(AsyncStorage, "setItem").mockImplementationOnce(
    async (key, value) => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      state.values.set(key, value);
    },
  );
  const blocking = storage.write("last-user", { id: "queue-blocker" });
  await pending;
  let current = true;
  const stale = storage.write(
    "last-user",
    { id: "ended-profile" },
    () => current,
  );
  current = false;
  release();
  await Promise.all([blocking, stale]);
  expect(await storage.read("last-user", null)).toEqual({
    id: "queue-blocker",
  });
});
