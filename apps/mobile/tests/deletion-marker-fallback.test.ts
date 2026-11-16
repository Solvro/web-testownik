import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  platform: "android",
  values: new Map<string, string>(),
  external: new Set<string>(),
  events: [] as string[],
  markerError: false,
  markerNoop: false,
  fallbackError: false,
  keysError: false,
  getError: false,
  externalReadError: false,
  secondarySupported: true,
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return f.platform;
    },
  },
}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-crypto", () => ({}));
vi.mock("../src/lib/deletion-markers", () => ({
  externalDeletionMarkers: {
    get supported() {
      return f.secondarySupported;
    },
    list: async () => {
      f.events.push("secondary:list");
      if (f.externalReadError)
        throw new Error("Secondary enumeration unavailable");
      return [...f.external];
    },
    write: async (owner: string) => {
      f.events.push("secondary:write");
      if (f.fallbackError) throw new Error("Secondary unavailable");
      f.external.add(owner);
    },
    remove: async (owner: string) => {
      f.external.delete(owner);
    },
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => {
  const write = async (key: string, value: string) => {
    if (key.startsWith("testownik.v1.account-deletion.")) {
      f.events.push("primary:marker");
      if (f.markerError) throw new Error("Generic primary marker I/O failure");
      if (f.markerNoop) return;
    }
    f.values.set(key, value);
  };
  const read = async (key: string) => {
    if (f.getError) throw new Error("Primary read unavailable");
    return f.values.get(key) ?? null;
  };
  const remove = async (key: string) => {
    f.events.push("erase");
    f.values.delete(key);
  };
  return {
    default: {
      getAllKeys: async () => {
        if (f.keysError) throw new Error("Primary enumeration unavailable");
        return [...f.values.keys()];
      },
      getItem: read,
      setItem: write,
      removeItem: remove,
      multiGet: async (keys: string[]) =>
        Promise.all(keys.map(async (k) => [k, await read(k)])),
      multiSet: async (pairs: [string, string][]) => {
        for (const [k, v] of pairs) await write(k, v);
      },
      multiRemove: async (keys: string[]) => {
        for (const key of keys) await remove(key);
      },
    },
  };
});
beforeEach(() => {
  vi.resetModules();
  f.platform = "android";
  f.values.clear();
  f.external.clear();
  f.events = [];
  f.markerError = false;
  f.markerNoop = false;
  f.fallbackError = false;
  f.keysError = false;
  f.getError = false;
  f.externalReadError = false;
  f.secondarySupported = true;
});
const owner = "server-confirmed-deleted";
const owned = `testownik.v1.draft.${owner}.new`;
const other = "testownik.v1.draft.other-owner.new";
function seed() {
  f.values.set(owned, '{"title":"Retained until durable intent"}');
  f.values.set(other, '{"title":"Other exact bytes"}');
}

it("persists healthy primary intent even when the secondary store is unavailable", async () => {
  seed();
  f.externalReadError = true;
  f.fallbackError = true;
  const { storage } = await import("../src/lib/storage");
  await expect(storage.purgeDeletedAccount(owner)).resolves.toEqual([]);
  expect(f.values.get(`testownik.v1.account-deletion.${owner}`)).toBe("true");
  expect(f.events.indexOf("primary:marker")).toBeLessThan(
    f.events.indexOf("erase"),
  );
  expect(f.events).not.toContain("secondary:write");
  expect(f.values.has(owned)).toBe(false);
  expect(f.values.get(other)).toBe('{"title":"Other exact bytes"}');
});

it.each(["android", "ios"])(
  "%s persists arbitrary primary marker failure before erase and recovers after relaunch",
  async (platform) => {
    f.platform = platform;
    seed();
    const otherBytes = f.values.get(other);
    const { storage } = await import("../src/lib/storage");
    f.markerError = true;
    await expect(storage.purgeDeletedAccount(owner)).resolves.toEqual([]);
    expect(f.events.indexOf("secondary:write")).toBeLessThan(
      f.events.indexOf("erase"),
    );
    expect(f.external.has(owner)).toBe(true);
    expect(f.values.has(owned)).toBe(false);
    expect(f.values.get(other)).toBe(otherBytes);
    vi.resetModules();
    f.markerError = false;
    const restarted = (await import("../src/lib/storage")).storage;
    expect(await restarted.pendingAccountDeletions()).toContain(owner);
    await restarted.write(`draft.${owner}.late`, { title: "Must not restore" });
    await restarted.write("last-user", { id: owner });
    expect(f.values.has(`testownik.v1.draft.${owner}.late`)).toBe(false);
    expect(f.values.has("testownik.v1.last-user")).toBe(false);
    expect(f.values.get(other)).toBe(otherBytes);
  },
);

it("detects resolved primary marker no-op before erasing private records", async () => {
  seed();
  f.markerNoop = true;
  const { storage } = await import("../src/lib/storage");
  await storage.purgeDeletedAccount(owner);
  expect(f.external.has(owner)).toBe(true);
  expect(f.events.indexOf("secondary:write")).toBeLessThan(
    f.events.indexOf("erase"),
  );
});

it("tries durable fallback for generic failure and preserves every byte if both stores fail", async () => {
  seed();
  const before = [...f.values];
  f.markerError = true;
  f.fallbackError = true;
  const { storage } = await import("../src/lib/storage");
  await expect(storage.purgeDeletedAccount(owner)).rejects.toThrow(
    "Secondary unavailable",
  );
  expect(f.events).toContain("secondary:write");
  expect(f.events).not.toContain("erase");
  expect([...f.values]).toEqual(before);
});

it("recognizes a known secondary intent even when the primary marker read fails", async () => {
  f.external.add(owner);
  f.getError = true;
  const { storage } = await import("../src/lib/storage");
  await expect(storage.isAccountDeletionPending(owner)).resolves.toBe(true);
});

it("consults secondary intents even if primary enumeration fails, while remaining fail closed", async () => {
  f.external.add(owner);
  f.keysError = true;
  const { storage } = await import("../src/lib/storage");
  await expect(storage.pendingAccountDeletions()).rejects.toBeDefined();
  expect(f.events).toContain("secondary:list");
});

it.each(["android", "ios"])(
  "%s retains a confirmed deletion guard after process restart following generic marker failure",
  async (platform) => {
    f.platform = platform;
    seed();
    f.values.set("testownik.v1.last-user", JSON.stringify({ id: owner }));
    const { storage } = await import("../src/lib/storage");
    f.markerError = true;
    // Simulate the UI retaining recovery state after a failed local cleanup.
    await storage.purgeDeletedAccount(owner).catch(() => undefined);
    // Kill the JS module state; device storage recovers before next launch.
    vi.resetModules();
    f.markerError = false;
    const restarted = (await import("../src/lib/storage")).storage;
    // The cached profile survives until credential cleanup. The marker must
    // independently prevent Session from mounting that deleted owner's content.
    expect(await restarted.read("last-user", null)).toEqual({ id: owner });
    expect(await restarted.pendingAccountDeletions()).toContain(owner);
    await restarted.write(`draft.${owner}.restored`, {
      title: "Must stay blocked",
    });
    expect(f.values.has(`testownik.v1.draft.${owner}.restored`)).toBe(false);
  },
);

it("keeps the original primary error and all owner bytes when browser IndexedDB is unavailable", async () => {
  f.platform = "web";
  f.secondarySupported = false;
  seed();
  const before = [...f.values];
  f.markerError = true;
  const { storage } = await import("../src/lib/storage");
  await expect(storage.purgeDeletedAccount(owner)).rejects.toThrow(
    "Generic primary marker I/O failure",
  );
  expect(f.events).not.toContain("secondary:write");
  expect(f.events).not.toContain("erase");
  expect([...f.values]).toEqual(before);
});

it.each(["primary", "secondary"])(
  "remembers known deleted owners before rejecting a partial %s marker scan",
  async (failure) => {
    if (failure === "primary") {
      f.external.add(owner);
      f.keysError = true;
    } else {
      f.values.set(`testownik.v1.account-deletion.${owner}`, "true");
      f.externalReadError = true;
    }
    const { storage } = await import("../src/lib/storage");
    await expect(
      storage.write("draft.other-owner.new", {
        title: "Blocked incomplete scan",
      }),
    ).rejects.toBeDefined();
    expect(f.values.has("testownik.v1.draft.other-owner.new")).toBe(false);
    // Successful-source ownership remains guarded even when a later external
    // cleanup removes that marker before the unreadable source recovers.
    f.keysError = false;
    f.externalReadError = false;
    f.external.clear();
    f.values.delete(`testownik.v1.account-deletion.${owner}`);
    await storage.write(`draft.${owner}.late`, {
      title: "Must not restore known deleted owner",
    });
    expect(f.values.has(`testownik.v1.draft.${owner}.late`)).toBe(false);
    await storage.write("draft.other-owner.new", {
      title: "Allowed after full scan",
    });
    expect(f.values.has("testownik.v1.draft.other-owner.new")).toBe(true);
  },
);
