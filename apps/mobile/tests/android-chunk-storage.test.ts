import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  CHUNK_BYTES,
  CHUNK_MARKER,
  CHUNK_PREFIX,
  MAX_CHUNK_VALUE_BYTES,
  createAndroidChunkStorage,
  type AtomicAndroidStorage,
} from "../src/lib/android-chunk-storage";
import { UserFacingError, userError } from "../src/lib/user-error";

const digest = async (value: string) =>
  createHash("sha256").update(value).digest("hex");
const key = "testownik.v1.offline.owner";
const big = "a".repeat(CHUNK_BYTES + 17);
function fixture() {
  const values = new Map<string, string>();
  const raw: AtomicAndroidStorage = {
    getItem: vi.fn(async (name: string) => values.get(name) ?? null),
    multiGet: vi.fn(async (names: readonly string[]) =>
      names.map((name) => [name, values.get(name) ?? null] as const),
    ),
    multiSet: vi.fn(async (pairs: readonly (readonly [string, string])[]) => {
      for (const [name, value] of pairs) values.set(name, value);
    }),
    multiRemove: vi.fn(async (names: readonly string[]) => {
      for (const name of names) values.delete(name);
    }),
    getAllKeys: vi.fn(async () => [...values.keys()]),
  };
  return { values, raw, store: createAndroidChunkStorage(raw, digest) };
}
const chunk = (name = key, index = 0) =>
  `${CHUNK_PREFIX}${encodeURIComponent(name)}:${index}`;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it("keeps small and legacy values directly readable without read migration", async () => {
  const { store, raw, values } = fixture();
  values.set(key, JSON.stringify({ queue: ["legacy-answer"] }));
  expect(await store.getItem(key)).toBe(values.get(key));
  expect(raw.multiSet).not.toHaveBeenCalled();
  await store.setItem(key, "small");
  expect(values.get(key)).toBe("small");
  expect(await store.getAllKeys()).toEqual([key]);
});
it("commits chunks and header together and preserves a large queued payload exactly", async () => {
  const { store, raw, values } = fixture();
  const value = JSON.stringify({
    questions: big.repeat(5),
    queue: [{ request_id: "retain-id", answer: "retain-answer" }],
  });
  await store.setItem(key, value);
  expect(raw.multiSet).toHaveBeenCalledTimes(1);
  const pairs = vi.mocked(raw.multiSet).mock.calls[0][0];
  expect(pairs.at(-1)?.[0]).toBe(key);
  expect(values.get(key)?.startsWith(CHUNK_MARKER)).toBe(true);
  for (const [name, part] of pairs)
    if (name !== key)
      expect(Buffer.byteLength(part)).toBeLessThanOrEqual(CHUNK_BYTES);
  expect(await store.getItem(key)).toBe(value);
  expect(await store.getAllKeys()).toEqual([key]);
});
it("bounds UTF8 rows and preserves Polish, three-byte and astral characters at cuts", async () => {
  const { store, values } = fixture();
  const value = "a".repeat(CHUNK_BYTES - 1) + "🦊漢ąż".repeat(120000);
  await store.setItem(key, value);
  expect(await store.getItem(key)).toBe(value);
  for (const [name, part] of values)
    if (name.startsWith(CHUNK_PREFIX)) {
      expect(Buffer.byteLength(part)).toBeLessThanOrEqual(CHUNK_BYTES);
      expect(part).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
    }
});
it("maps native multiGet by key instead of depending on native row order", async () => {
  const { store, raw } = fixture();
  await store.setItem(key, big);
  const original = raw.multiGet;
  raw.multiGet = async (names) => [...(await original(names))].reverse();
  expect(await store.getItem(key)).toBe(big);
});
for (const damage of [
  "missing",
  "changed",
  "swapped",
  "bad-header",
  "future-header",
  "overlarge-header",
]) {
  it(`reports ${damage} without altering committed bytes or treating them as absent`, async () => {
    const { store, values } = fixture();
    await store.setItem(key, big + "different-end");
    if (damage === "missing") values.delete(chunk());
    if (damage === "changed") values.set(chunk(), "b".repeat(CHUNK_BYTES));
    if (damage === "swapped") {
      const first = values.get(chunk())!;
      values.set(chunk(), values.get(chunk(key, 1))!);
      values.set(chunk(key, 1), first);
    }
    if (damage === "bad-header") values.set(key, CHUNK_MARKER + "{broken");
    if (damage === "future-header") values.set(key, "#testownik-chunked-v2#{}");
    if (damage === "overlarge-header")
      values.set(
        key,
        CHUNK_MARKER +
          JSON.stringify({
            count: 999999,
            length: 1,
            bytes: 1,
            sha256: "0".repeat(64),
          }),
      );
    const before = [...values];
    await expect(store.getItem(key)).rejects.toMatchObject({
      code: "localData",
    });
    await expect(store.setItem(key, "replacement")).rejects.toMatchObject({
      code: "localData",
    });
    expect([...values]).toEqual(before);
  });
}
it("failed atomic commit leaves the old header, chunks and queued answer unchanged", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big);
  const before = [...values];
  vi.mocked(raw.multiSet).mockRejectedValueOnce(
    new Error("Simulated SQLite transaction rollback"),
  );
  await expect(store.setItem(key, big.replace("a", "b"))).rejects.toThrow(
    "rollback",
  );
  expect([...values]).toEqual(before);
  expect(await store.getItem(key)).toBe(big);
});
it("classifies native SQLITE_FULL while preserving the previously saved value", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big);
  const before = [...values];
  vi.mocked(raw.multiSet).mockRejectedValueOnce([
    { message: "database or disk is full (code 13 SQLITE_FULL)" },
  ]);
  await expect(store.setItem(key, big + "x")).rejects.toMatchObject({
    code: "storageFull",
  });
  expect([...values]).toEqual(before);
});
it("rejects an over-cap write before touching native rows", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big);
  vi.mocked(raw.multiSet).mockClear();
  const before = [...values];
  await expect(
    store.setItem(key, "z".repeat(MAX_CHUNK_VALUE_BYTES + 1)),
  ).rejects.toMatchObject({ code: "storageValueTooLarge" });
  expect(raw.multiSet).not.toHaveBeenCalled();
  expect([...values]).toEqual(before);
});
it("shrinks in place and removes obsolete high slots without a second generation", async () => {
  const { store, values } = fixture();
  await store.setItem(key, big.repeat(4));
  await store.setItem(key, big);
  expect([...values.keys()].sort()).toEqual(
    [key, chunk(), chunk(key, 1)].sort(),
  );
  expect(await store.getItem(key)).toBe(big);
  await store.setItem(key, "synced queue empty");
  expect([...values]).toEqual([[key, "synced queue empty"]]);
});
it("a cleanup failure still resolves the committed write; retry reclaims leftovers", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big.repeat(4));
  vi.mocked(raw.multiRemove).mockRejectedValueOnce(
    new Error("Cleanup interrupted"),
  );
  await expect(store.setItem(key, "committed")).resolves.toBeUndefined();
  expect(await store.getItem(key)).toBe("committed");
  expect(values.has(chunk())).toBe(true);
  await store.setItem(key, "next commit");
  expect([...values]).toEqual([[key, "next commit"]]);
});
it("discovers headerless owner slots for purge and removes only canonical same-key rows", async () => {
  const { store, values } = fixture();
  const other = "testownik.v1.offline.other";
  values.set(chunk(), "orphan private data");
  values.set(chunk(other), "other private data");
  values.set(
    `${CHUNK_PREFIX}${encodeURIComponent(key)}:01`,
    "malformed index evidence",
  );
  values.set(
    `${CHUNK_PREFIX}testownik%2ev1.offline.owner:0`,
    "noncanonical encoding",
  );
  values.set("unrelated-native-module", "retain");
  expect((await store.getAllKeys()).sort()).toEqual(
    [key, other, "unrelated-native-module"].sort(),
  );
  await store.removeItem(key);
  expect(values.has(chunk())).toBe(false);
  expect(values.get(chunk(other))).toBe("other private data");
  expect(values.get(`${CHUNK_PREFIX}${encodeURIComponent(key)}:01`)).toBe(
    "malformed index evidence",
  );
  expect(values.get("unrelated-native-module")).toBe("retain");
});
it("explicit removal works with a damaged header and failed removal preserves rows", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big);
  values.set(key, CHUNK_MARKER + "broken");
  const before = [...values];
  vi.mocked(raw.multiRemove).mockRejectedValueOnce(
    new Error("Remove rollback"),
  );
  await expect(store.removeItem(key)).rejects.toThrow("rollback");
  expect([...values]).toEqual(before);
  await store.removeItem(key);
  expect(values.size).toBe(0);
});
it("shares per-key locks across adapters and orders read then remove after a write", async () => {
  const { store, raw, values } = fixture();
  const second = createAndroidChunkStorage(raw, digest);
  const entered = deferred(),
    held = deferred();
  vi.mocked(raw.multiSet).mockImplementationOnce(async (pairs) => {
    entered.resolve();
    await held.promise;
    for (const [name, value] of pairs) values.set(name, value);
  });
  const writing = store.setItem(key, big);
  await entered.promise;
  const reading = second.getItem(key),
    removing = second.removeItem(key);
  expect(values.size).toBe(0);
  held.resolve();
  await writing;
  expect(await reading).toBe(big);
  await removing;
  expect(await store.getItem(key)).toBeNull();
});
it("a blocked key does not hold another owner and rejected operations do not poison locks", async () => {
  const { store, raw } = fixture();
  const entered = deferred(),
    held = deferred();
  vi.mocked(raw.multiSet).mockImplementationOnce(async () => {
    entered.resolve();
    await held.promise;
    throw new Error("rollback");
  });
  const failed = store.setItem(key, big);
  const rejection = expect(failed).rejects.toThrow("rollback");
  await entered.promise;
  await store.setItem("testownik.v1.offline.other", "independent");
  held.resolve();
  await rejection;
  await store.setItem(key, "recovered");
  expect(await store.getItem(key)).toBe("recovered");
});
it("retries a changed authoritative header instead of reporting a reload read race", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big);
  vi.mocked(raw.multiGet).mockImplementationOnce(async (names) => {
    values.set(key, "new small committed value");
    return names.map((name) => [name, null] as const);
  });
  expect(await store.getItem(key)).toBe("new small committed value");
});
for (const value of [
  "#testownik-chunked-v1#{}",
  "bad\uD800",
  "bad\uDC00",
  "bad\u0000",
]) {
  it("rejects unroundtrippable or reserved incoming values without losing old data", async () => {
    const { store, values } = fixture();
    values.set(key, "old");
    await expect(store.setItem(key, value)).rejects.toMatchObject({
      code: "operation",
    });
    expect(values.get(key)).toBe("old");
  });
}
it("keeps escaped key namespaces distinct", async () => {
  const { store, values } = fixture();
  const first = "testownik.v1.chat.owner.a:b%",
    second = "testownik.v1.chat.owner.a%3Ab%25";
  await store.setItem(first, big);
  await store.setItem(second, big + "second");
  await store.removeItem(first);
  expect(await store.getItem(second)).toBe(big + "second");
  expect([...values.keys()]).not.toContain(chunk(first));
});
it("provides distinct localized size and capacity guidance", () => {
  const full = new UserFacingError("storageFull");
  const limit = new UserFacingError("storageValueTooLarge");
  expect(userError(full, (_, en) => en)).toContain("Storage is full");
  expect(userError(limit, (_, en) => en)).toContain("8 MB");
  expect(userError(full, (pl) => pl)).toContain("Brak miejsca");
  expect(userError(limit, (pl) => pl)).toContain("limit zapisu");
});

it("normalizes batched native errors without calling them connection failures", async () => {
  const { store, raw } = fixture();
  vi.mocked(raw.multiSet).mockRejectedValueOnce([
    new Error("Native insert failed"),
  ]);
  await expect(store.setItem(key, "new")).rejects.toMatchObject({
    code: "operation",
  });
  await store.setItem(key, big);
  vi.mocked(raw.multiGet).mockRejectedValueOnce([
    new Error("Native read failed"),
  ]);
  await expect(store.getItem(key)).rejects.toMatchObject({ code: "localData" });
  vi.mocked(raw.multiRemove).mockRejectedValueOnce([
    new Error("Native delete failed"),
  ]);
  await expect(store.removeItem(key)).rejects.toMatchObject({
    code: "operation",
  });
});
it("a failed hash cannot modify an existing committed value", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big);
  const failing = createAndroidChunkStorage(raw, async () => {
    throw new Error("Digest unavailable");
  });
  const before = [...values];
  await expect(failing.setItem(key, big + "next")).rejects.toThrow(
    "Digest unavailable",
  );
  expect([...values]).toEqual(before);
});
it("uses a verified unchanged header to avoid hashing the old snapshot twice", async () => {
  const { raw } = fixture();
  const hash = vi.fn(digest);
  const store = createAndroidChunkStorage(raw, hash);
  await store.setItem(key, big);
  await store.getItem(key);
  hash.mockClear();
  vi.mocked(raw.multiGet).mockClear();
  await store.setItem(key, big + "next answer");
  expect(hash).toHaveBeenCalledTimes(1);
  expect(raw.multiGet).not.toHaveBeenCalled();
});
it("scans slot inventory once for small autosaves and retries a failed initial scan", async () => {
  const { store, raw, values } = fixture();
  vi.mocked(raw.getAllKeys).mockRejectedValueOnce(
    new Error("Inventory unavailable"),
  );
  await store.setItem(key, "first");
  expect(values.get(key)).toBe("first");
  await store.setItem(key, "second");
  await store.setItem(key, "third");
  await store.setItem("testownik.v1.draft.owner.new", "draft");
  expect(raw.getAllKeys).toHaveBeenCalledTimes(2);
});
it("skips obsolete-slot cleanup if the authoritative header already changed", async () => {
  const { store, raw, values } = fixture();
  await store.setItem(key, big.repeat(3));
  vi.mocked(raw.getItem)
    .mockImplementationOnce(async (name) => values.get(name) ?? null)
    .mockImplementationOnce(async (name) => values.get(name) ?? null)
    .mockImplementationOnce(async () => "different writer committed");
  vi.mocked(raw.multiRemove).mockClear();
  await store.setItem(key, "new direct value");
  expect(raw.multiRemove).not.toHaveBeenCalled();
  expect(values.has(chunk(key, 2))).toBe(true);
});
for (const size of [0, CHUNK_BYTES, CHUNK_BYTES + 1, MAX_CHUNK_VALUE_BYTES]) {
  it(`roundtrips the exact ${size}-byte boundary`, async () => {
    const { store, values } = fixture();
    const value = "x".repeat(size);
    await store.setItem(key, value);
    expect(await store.getItem(key)).toBe(value);
    expect(values.get(key)?.startsWith(CHUNK_MARKER)).toBe(size > CHUNK_BYTES);
  });
}
for (const invalidKey of [
  CHUNK_PREFIX + "reserved",
  "testownik.v1.bad\uD800",
]) {
  it("rejects invalid logical keys asynchronously", async () => {
    const { store } = fixture();
    await expect(store.getItem(invalidKey)).rejects.toMatchObject({
      code: "operation",
    });
    await expect(store.setItem(invalidKey, "value")).rejects.toMatchObject({
      code: "operation",
    });
    await expect(store.removeItem(invalidKey)).rejects.toMatchObject({
      code: "operation",
    });
  });
}
it("does not reinterpret unrelated native module values", async () => {
  const { store } = fixture();
  const value = CHUNK_MARKER + "not our protocol";
  await store.setItem("other-native-module", value);
  expect(await store.getItem("other-native-module")).toBe(value);
  await store.removeItem("other-native-module");
  expect(await store.getItem("other-native-module")).toBeNull();
});
