import { beforeEach, expect, it, vi } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import { offlineTransaction } from "../src/lib/offline";
const accountLockScope = new AsyncLocalStorage<{ active: boolean }>();
const f = vi.hoisted(() => ({
  values: new Map<string, string>(),
  profile: new Map<string, string>(),
  pending: new Set<string>(),
  deleted: new Set<string>(),
  lock: Promise.resolve() as Promise<unknown>,
  offlineLock: Promise.resolve() as Promise<unknown>,
  offlineLockDenied: false,
  externalError: false,
  primaryError: false,
  platform: "web",
  enumerationHold: null as null | { entered: () => void; wait: Promise<void> },
  lockDenied: false,
  events: [] as string[],
  holdKey: "",
  hold: null as Promise<void> | null,
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return f.platform;
    },
  },
}));
vi.mock("expo-crypto", () => ({}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("../src/lib/account-data-lock", () => ({
  withOfflineDataLock: (run: () => Promise<unknown>) => {
    if (accountLockScope.getStore()?.active)
      return Promise.reject(new Error("INVERTED_LOCK_ORDER"));
    if (f.offlineLockDenied)
      return Promise.reject(new Error("OFFLINE_LOCK_UNAVAILABLE"));
    const next = f.offlineLock.then(run);
    f.offlineLock = next.catch(() => undefined);
    return next;
  },
  withAccountDataLock: (run: () => Promise<unknown>) => {
    if (f.lockDenied) return Promise.reject(new Error("LOCK_UNAVAILABLE"));
    const next = f.lock.then(() => {
      const scope = { active: true };
      return accountLockScope.run(scope, async () => {
        try {
          return await run();
        } finally {
          scope.active = false;
        }
      });
    });
    f.lock = next.catch(() => undefined);
    return next;
  },
}));
vi.mock("../src/lib/deletion-markers", () => ({
  externalDeletionMarkers: {
    supported: true,
    list: async () => {
      if (f.externalError) throw new Error("IDB unavailable");
      return [...f.pending];
    },
    scan: async () => {
      if (f.externalError) throw new Error("IDB unavailable");
      return { pending: [...f.pending], deleted: [...f.deleted] };
    },
    write: async (owner: string) => {
      if (f.externalError) throw new Error("IDB unavailable");
      f.pending.add(owner);
    },
    writeDeleted: async (owner: string) => {
      if (f.externalError) throw new Error("IDB unavailable");
      f.deleted.add(owner);
    },
    remove: async (owner: string) => {
      if (f.externalError) throw new Error("IDB unavailable");
      f.pending.delete(owner);
    },
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getAllKeys: async () => {
      if (f.primaryError) throw new Error("Primary unavailable");
      const keys = [...f.values.keys()],
        held = f.enumerationHold;
      f.enumerationHold = null;
      if (held) {
        held.entered();
        await held.wait;
      }
      return keys;
    },
    getItem: async (key: string) => f.values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      f.events.push(`write:${key}`);
      if (key === f.holdKey && f.hold) await f.hold;
      f.values.set(key, value);
    },
    removeItem: async (key: string) => {
      f.events.push(`remove:${key}`);
      f.values.delete(key);
    },
  },
}));
const owner = "deleted-A",
  draft = `testownik.v1.draft.${owner}.new`,
  marker = `testownik.v1.account-deletion.${owner}`;
beforeEach(() => {
  vi.resetModules();
  f.values.clear();
  f.profile.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => f.profile.get(key) ?? null,
    setItem: (key: string, value: string) => f.profile.set(key, value),
    removeItem: (key: string) => f.profile.delete(key),
  });
  f.pending.clear();
  f.deleted.clear();
  f.events = [];
  f.lock = Promise.resolve();
  f.offlineLock = Promise.resolve();
  f.offlineLockDenied = false;
  f.externalError = false;
  f.primaryError = false;
  f.platform = "web";
  f.enumerationHold = null;
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      addEventListener() {}
      removeEventListener() {}
      postMessage() {}
      close() {}
    },
  );
  vi.stubGlobal("addEventListener", vi.fn());
  vi.stubGlobal("removeEventListener", vi.fn());
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    visibilityState: "visible",
  });
  f.lockDenied = false;
  f.holdKey = "";
  f.hold = null;
});
async function tabs() {
  const a = (await import("../src/lib/storage")).storage;
  vi.resetModules();
  const b = (await import("../src/lib/storage")).storage;
  return { a, b };
}
it("blocks a second context's cached owner writes after completed cleanup and preserves B", async () => {
  const { a, b } = await tabs();
  await b.write(`draft.${owner}.new`, { title: "A private draft" });
  await a.purgeDeletedAccount(owner);
  await a.completeAccountDeletion(owner);
  expect(await a.pendingAccountDeletions()).toEqual([]);
  expect(await a.accountDeletionOwners()).toContain(owner);
  await b.write(`draft.${owner}.new`, { title: "Must not resurrect" });
  await b.write("draft.retained-B.new", { title: "B saved" });
  expect(f.values.has(draft)).toBe(false);
  expect(f.values.get("testownik.v1.draft.retained-B.new")).toBe(
    '{"title":"B saved"}',
  );
});
it("drops a write already queued before deletion when it acquires the shared lock later", async () => {
  const { a, b } = await tabs();
  let release!: () => void;
  f.lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writing = b.write(`draft.${owner}.new`, {
    title: "Queued before deletion",
  });
  const deleting = a.purgeDeletedAccount(owner);
  await vi.waitFor(() => expect(f.values.get(marker)).toBe("true"));
  release();
  await Promise.all([writing, deleting]);
  expect(f.values.has(draft)).toBe(false);
  expect(f.deleted.has(owner)).toBe(true);
});
it("waits for an existing lock holder then purges its completed late write", async () => {
  const { a, b } = await tabs();
  let release!: () => void;
  f.holdKey = draft;
  f.hold = new Promise((resolve) => {
    release = resolve;
  });
  const writing = b.write(`draft.${owner}.new`, {
    title: "Already committing",
  });
  await vi.waitFor(() => expect(f.events).toContain(`write:${draft}`));
  const finished = vi.fn(),
    deleting = a.purgeDeletedAccount(owner).then(finished);
  await vi.waitFor(() => expect(f.values.get(marker)).toBe("true"));
  expect(finished).not.toHaveBeenCalled();
  release();
  await writing;
  await deleting;
  expect(f.values.has(draft)).toBe(false);
});
it("retains primary pending intent and all saved bytes when authoritative IDB guard fails", async () => {
  f.values.set(draft, '{"title":"Private retained"}');
  f.externalError = true;
  const { a } = await tabs();
  await expect(a.purgeDeletedAccount(owner)).rejects.toMatchObject({
    code: "browserStorageCoordination",
  });
  expect(f.values.get(marker)).toBe("true");
  expect(f.values.get(draft)).toBe('{"title":"Private retained"}');
  expect(f.events.some((event) => event.startsWith("remove:"))).toBe(false);
});
it("retains confirmed intent before shared lock acquisition fails", async () => {
  f.values.set(draft, '{"title":"Private retained"}');
  f.lockDenied = true;
  const { a } = await tabs();
  await expect(a.purgeDeletedAccount(owner)).rejects.toThrow(
    "LOCK_UNAVAILABLE",
  );
  expect(f.values.get(marker)).toBe("true");
  expect(f.values.get(draft)).toBe('{"title":"Private retained"}');
});
it("keeps pending intent and data when the outer offline lock fails after the durable guard commits", async () => {
  f.values.set(draft, '{"title":"Private retained"}');
  f.offlineLockDenied = true;
  const { a } = await tabs();
  expect(a.withOfflineTransaction).toBeTypeOf("function");
  await expect(a.purgeDeletedAccount(owner)).rejects.toThrow(
    "OFFLINE_LOCK_UNAVAILABLE",
  );
  expect(f.values.get(marker)).toBe("true");
  expect(f.deleted.has(owner)).toBe(true);
  expect(f.values.get(draft)).toBe('{"title":"Private retained"}');
  expect(f.events.some((event) => event.startsWith("remove:"))).toBe(false);
  f.offlineLockDenied = false;
  await a.purgeDeletedAccount(owner);
  await a.completeAccountDeletion(owner);
  expect(f.values.has(draft)).toBe(false);
  expect(await a.pendingAccountDeletions()).toEqual([]);
});
it("commits the deletion guard without waiting for an outer offline holder, then blocks its late answer write", async () => {
  const { a, b } = await tabs();
  const key = `offline.${owner}`,
    rawKey = `testownik.v1.${key}`;
  f.values.set(rawKey, JSON.stringify({ quizzes: {}, queue: [], errors: {} }));
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
      release = resolve;
    }),
    entered = vi.fn();
  const writing = offlineTransaction(b, async () => {
    entered();
    await held;
    await b.write(key, {
      quizzes: {},
      queue: ["Late retained answer"],
      errors: {},
    });
  });
  await vi.waitFor(() => expect(entered).toHaveBeenCalledOnce());
  const finished = vi.fn(),
    deleting = a.purgeDeletedAccount(owner).then(finished);
  await vi.waitFor(() => expect(f.deleted.has(owner)).toBe(true));
  expect(finished).not.toHaveBeenCalled();
  release();
  await Promise.all([writing, deleting]);
  expect(f.values.has(rawKey)).toBe(false);
  // The stale transaction did acquire the account-data leaf, but no data write
  // happened after the confirmed owner guard was installed.
  expect(f.events).not.toContain(`write:${rawKey}`);
});
it("sweeps completed owner residue without recreating a pending recovery marker", async () => {
  f.deleted.add(owner);
  f.values.set(draft, '{"title":"Residual private draft"}');
  const { a } = await tabs();
  await a.purgeDeletedAccount(owner);
  expect(f.events).not.toContain(`write:${marker}`);
  expect(f.values.has(draft)).toBe(false);
  expect(await a.pendingAccountDeletions()).toEqual([]);
  await a.completeAccountDeletion(owner);
  expect(f.deleted.has(owner)).toBe(true);
});
it("does not drop pending cleanup without a verified permanent guard", async () => {
  f.values.set(marker, "true");
  const { a } = await tabs();
  await expect(a.completeAccountDeletion(owner)).rejects.toMatchObject({
    code: "browserStorageCoordination",
  });
  expect(f.values.get(marker)).toBe("true");
});
it("preserves B's per-tab and legacy cached profile during A conditional cleanup", async () => {
  const { a, b } = await tabs();
  f.values.set("testownik.v1.last-user", JSON.stringify({ id: "retained-B" }));
  await b.write("last-user", { id: "retained-B" });
  await a.removeLastUser(owner);
  expect(f.values.get("testownik.v1.last-user")).toBe('{"id":"retained-B"}');
  expect(f.profile.get("testownik.v1.last-user")).toBe('{"id":"retained-B"}');
});

it("never hydrates a shared legacy web profile without authoritative identity", async () => {
  f.values.set("testownik.v1.last-user", '{"id":"unrelated-A"}');
  const { a } = await tabs();
  expect(await a.read("last-user", null)).toBeNull();
  expect(f.values.get("testownik.v1.last-user")).toBe('{"id":"unrelated-A"}');
  await a.write("last-user", { id: "validated-B" });
  expect(await a.read("last-user", null)).toEqual({ id: "validated-B" });
  expect(f.values.get("testownik.v1.last-user")).toBe('{"id":"unrelated-A"}');
});

it("explicitly removes matching per-tab and legacy profiles while retaining account banks", async () => {
  f.values.set("testownik.v1.last-user", JSON.stringify({ id: owner }));
  f.profile.set("testownik.v1.last-user", JSON.stringify({ id: owner }));
  f.values.set(`testownik.v1.offline.${owner}`, "Saved bank exact bytes");
  const { a } = await tabs();
  await a.removeLastUser(owner);
  expect(f.values.has("testownik.v1.last-user")).toBe(false);
  expect(f.profile.has("testownik.v1.last-user")).toBe(false);
  expect(f.values.get(`testownik.v1.offline.${owner}`)).toBe(
    "Saved bank exact bytes",
  );
});

it("does not cache a profile after its session ends during the asynchronous ownership check", async () => {
  const { a } = await tabs();
  let current = true;
  const writing = a.write("last-user", { id: "ended-A" }, () => current);
  current = false;
  await writing;
  expect(f.profile.has("testownik.v1.last-user")).toBe(false);
});

for (const legacy of [JSON.stringify({ id: owner }), "{damaged"]) {
  it(`cleans an owned or damaged legacy profile when the current tab has no cache: ${legacy}`, async () => {
    const { a } = await tabs();
    f.values.set("testownik.v1.last-user", legacy);
    await a.removeLastUser(owner);
    expect(f.values.has("testownik.v1.last-user")).toBe(false);
    expect(f.profile.has("testownik.v1.last-user")).toBe(false);
  });
}

it("notifies once when a private write discovers another context's durable deletion and still preserves B", async () => {
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  const unsubscribe = module.subscribeAccountDeletion(seen);
  await module.storage.write(`draft.${owner}.new`, {
    title: "Before deletion",
  });
  f.values.delete(draft);
  f.deleted.add(owner);
  await module.storage.write(`draft.${owner}.new`, {
    title: "Must stay deleted",
  });
  await module.storage.accountDeletionOwners();
  await module.storage.write("draft.retained-B.new", { title: "B saved" });
  expect(seen.mock.calls).toEqual([[owner]]);
  expect(f.values.has(draft)).toBe(false);
  expect(f.values.get("testownik.v1.draft.retained-B.new")).toBe(
    '{"title":"B saved"}',
  );
  expect(f.pending.size).toBe(0);
  unsubscribe();
});

for (const failed of ["primary", "secondary"] as const) {
  it(`notifies only known positive owners while ${failed} scan still rejects`, async () => {
    const module = await import("../src/lib/storage"),
      seen = vi.fn();
    const unsubscribe = module.subscribeAccountDeletion(seen);
    if (failed === "primary") {
      f.deleted.add(owner);
      f.primaryError = true;
    } else {
      f.values.set(marker, "true");
      f.externalError = true;
    }
    await expect(module.storage.accountDeletionOwners()).rejects.toMatchObject({
      code: "browserStorageCoordination",
    });
    await expect(module.storage.accountDeletionOwners()).rejects.toMatchObject({
      code: "browserStorageCoordination",
    });
    expect(seen.mock.calls).toEqual([[owner]]);
    expect(f.values.has(draft)).toBe(false);
    unsubscribe();
  });
}

it("does not invent a notification when both marker sources are unreadable", async () => {
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  const unsubscribe = module.subscribeAccountDeletion(seen);
  f.primaryError = true;
  f.externalError = true;
  await expect(module.storage.accountDeletionOwners()).rejects.toMatchObject({
    code: "browserStorageCoordination",
  });
  expect(seen).not.toHaveBeenCalled();
  unsubscribe();
});

it("isolates throwing listeners and never awaits cleanup under the private-write leaf", async () => {
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  let cleanup: Promise<unknown> | undefined;
  const offBad = module.subscribeAccountDeletion(() => {
    throw new Error("Subscriber failed");
  });
  const offCleanup = module.subscribeAccountDeletion((id) => {
    seen(id);
    cleanup = module.storage.purgeDeletedAccount(id);
  });
  f.deleted.add(owner);
  await expect(
    module.storage.write(`draft.${owner}.new`, { title: "Blocked" }),
  ).resolves.toBeUndefined();
  expect(seen).toHaveBeenCalledExactlyOnceWith(owner);
  expect(cleanup).toBeDefined();
  await cleanup;
  expect(f.pending.size).toBe(0);
  expect(f.values.has(draft)).toBe(false);
  offBad();
  offCleanup();
});

it("native marker discovery remains independent of browser UI notifications", async () => {
  f.platform = "ios";
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  const unsubscribe = module.subscribeAccountDeletion(seen);
  f.pending.add(owner);
  expect(await module.storage.accountDeletionOwners()).toContain(owner);
  expect(seen).not.toHaveBeenCalled();
  unsubscribe();
});

it("a newer verified positive survives an older successful scan returning later", async () => {
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  const unsubscribe = module.subscribeAccountDeletion(seen);
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.enumerationHold = {
    entered,
    wait: new Promise<void>((resolve) => {
      release = resolve;
    }),
  };
  const older = module.storage.accountDeletionOwners();
  await started;
  f.deleted.add(owner);
  expect(await module.storage.accountDeletionOwners()).toContain(owner);
  release();
  expect(await older).toContain(owner);
  expect(seen.mock.calls).toEqual([[owner]]);
  unsubscribe();
});

it("a preexisting provisional owner still notifies when its marker becomes durable", async () => {
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  f.values.set(marker, "true");
  expect(await module.storage.isAccountDeletionPending(owner)).toBe(true);
  const unsubscribe = module.subscribeAccountDeletion(seen);
  expect(await module.storage.accountDeletionOwners()).toContain(owner);
  expect(seen.mock.calls).toEqual([[owner]]);
  unsubscribe();
});

it("listener failure cannot reject explicit confirmed deletion after its guard commits", async () => {
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  const offBad = module.subscribeAccountDeletion(() => {
    throw new Error("UI failed");
  });
  const offGood = module.subscribeAccountDeletion(seen);
  f.values.set(draft, '{"title":"Private"}');
  await expect(module.storage.purgeDeletedAccount(owner)).resolves.toEqual([]);
  expect(f.deleted.has(owner)).toBe(true);
  expect(f.values.has(draft)).toBe(false);
  expect(seen).toHaveBeenCalledWith(owner);
  offBad();
  offGood();
});

it("last-user discovery can start cleanup without waiting on its own profile queue", async () => {
  const module = await import("../src/lib/storage"),
    seen = vi.fn();
  let cleanup: Promise<unknown> | undefined;
  const off = module.subscribeAccountDeletion((id) => {
    seen(id);
    cleanup = module.storage
      .purgeDeletedAccount(id)
      .then(() => module.storage.removeLastUser(id));
  });
  f.profile.set("testownik.v1.last-user", JSON.stringify({ id: owner }));
  f.deleted.add(owner);
  await expect(
    module.storage.write("last-user", { id: owner }),
  ).resolves.toBeUndefined();
  expect(seen).toHaveBeenCalledExactlyOnceWith(owner);
  expect(cleanup).toBeDefined();
  await cleanup;
  expect(f.profile.has("testownik.v1.last-user")).toBe(false);
  off();
});

it("the active lock fixture still rejects an awaited outer transaction inside a leaf", async () => {
  const { withAccountDataLock } = await import("../src/lib/account-data-lock");
  const { storage } = await import("../src/lib/storage");
  await expect(
    withAccountDataLock(() =>
      storage.withOfflineTransaction(() => Promise.resolve()),
    ),
  ).rejects.toThrow("INVERTED_LOCK_ORDER");
  await expect(
    storage.withOfflineTransaction(() => Promise.resolve("recovered")),
  ).resolves.toBe("recovered");
});
