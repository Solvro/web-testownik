import { UserFacingError, type UserErrorCode } from "./user-error";

// Android AsyncStorage 2.2 uses a SQLite transaction for each multiSet/multiRemove.
// Fixed slots and their header must commit together. Do not use this on iOS/web.
export const CHUNK_BYTES = 512 * 1024;
export const MAX_CHUNK_VALUE_BYTES = 8 * 1024 * 1024;
const MAX_READ_BYTES = 32 * 1024 * 1024;
const MAX_SLOTS = Math.ceil(MAX_READ_BYTES / (CHUNK_BYTES - 3));
const LOGICAL_PREFIX = "testownik.v1.";
export const CHUNK_PREFIX = "testownik.chunks.v1/";
const MARKER_FAMILY = "#testownik-chunked-";
export const CHUNK_MARKER = `${MARKER_FAMILY}v1#`;

type Pair = readonly [string, string | null];
export type AtomicAndroidStorage = {
  getItem(key: string): Promise<string | null>;
  multiGet(keys: readonly string[]): Promise<readonly Pair[]>;
  multiSet(values: readonly (readonly [string, string])[]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
};
type Header = { count: number; length: number; bytes: number; sha256: string };
const locks = new WeakMap<AtomicAndroidStorage, Map<string, Promise<void>>>();

function serial<T>(
  raw: AtomicAndroidStorage,
  key: string,
  run: () => Promise<T>,
) {
  let map = locks.get(raw);
  if (!map) locks.set(raw, (map = new Map()));
  const next = (map.get(key) ?? Promise.resolve()).then(run);
  const settled = next.then(
    () => undefined,
    () => undefined,
  );
  map.set(key, settled);
  return next.finally(() => {
    if (map.get(key) === settled) map.delete(key);
  });
}
function bad(): never {
  throw new UserFacingError("localData");
}
function encoded(key: string) {
  if (key.startsWith(CHUNK_PREFIX)) throw new UserFacingError("operation");
  try {
    return encodeURIComponent(key);
  } catch {
    throw new UserFacingError("operation");
  }
}
function slot(key: string, index: number) {
  return `${CHUNK_PREFIX}${encoded(key)}:${index}`;
}
function parseSlot(key: string) {
  if (!key.startsWith(CHUNK_PREFIX)) return null;
  const suffix = key.slice(CHUNK_PREFIX.length);
  const match = /^([^:]+):(0|[1-9]\d{0,2})$/.exec(suffix);
  if (!match) return null;
  const index = Number(match[2]);
  if (index >= MAX_SLOTS) return null;
  try {
    const logical = decodeURIComponent(match[1]);
    if (!logical.startsWith(LOGICAL_PREFIX) || encoded(logical) !== match[1])
      return null;
    return { logical, index };
  } catch {
    return null;
  }
}
function header(value: string): Header | null {
  if (!value.startsWith(MARKER_FAMILY)) return null;
  if (!value.startsWith(CHUNK_MARKER)) bad();
  let result: Header;
  try {
    result = JSON.parse(value.slice(CHUNK_MARKER.length));
  } catch {
    return bad();
  }
  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    !Number.isSafeInteger(result.count) ||
    result.count < 2 ||
    result.count > MAX_SLOTS ||
    !Number.isSafeInteger(result.length) ||
    result.length < 1 ||
    result.length > MAX_READ_BYTES ||
    !Number.isSafeInteger(result.bytes) ||
    result.bytes <= CHUNK_BYTES ||
    result.bytes > MAX_READ_BYTES ||
    result.bytes < result.length ||
    result.bytes > result.count * CHUNK_BYTES ||
    typeof result.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(result.sha256)
  )
    bad();
  return result;
}
/** Returns slices bounded by UTF-8 bytes; never splits a surrogate pair. */
function split(value: string, maxBytes: number, error: UserErrorCode) {
  const chunks: string[] = [];
  let start = 0,
    partBytes = 0,
    bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    let size: number,
      units = 1;
    if (code === 0 || (code >= 0xdc00 && code <= 0xdfff))
      throw new UserFacingError(error === "localData" ? error : "operation");
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff))
        throw new UserFacingError(error === "localData" ? error : "operation");
      size = 4;
      units = 2;
    } else size = code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
    bytes += size;
    if (bytes > maxBytes) throw new UserFacingError(error);
    if (partBytes + size > CHUNK_BYTES) {
      chunks.push(value.slice(start, index));
      start = index;
      partBytes = 0;
    }
    partBytes += size;
    index += units - 1;
  }
  if (start < value.length) chunks.push(value.slice(start));
  return { chunks, bytes };
}
/** Uses the same Unicode byte accounting as native chunks, without TextEncoder. */
export function storedValueBytes(value: unknown): number {
  const json = JSON.stringify(value);
  if (json === undefined) throw new UserFacingError("operation");
  return split(json, Number.MAX_SAFE_INTEGER, "operation").bytes;
}
function isFull(error: unknown): boolean {
  if (Array.isArray(error)) return error.some(isFull);
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : error;
  return (
    typeof message === "string" &&
    /SQLITE_FULL|database or disk is full/i.test(message)
  );
}
function nativeError(error: unknown, context: "localData" | "operation") {
  // AsyncStorage's batched JS methods reject with arrays rather than Error.
  // Let UI classify these as storage failures, never as lost connectivity.
  return Array.isArray(error) ? new UserFacingError(context) : error;
}

/** One instance per raw store; locks are shared even across adapter instances. */
export function createAndroidChunkStorage(
  raw: AtomicAndroidStorage,
  digest: (value: string) => Promise<string>,
) {
  const verified = new Map<string, string>();
  let inventoryPromise: Promise<Map<string, Set<string>>> | null = null;
  function inventory() {
    return (inventoryPromise ??= raw
      .getAllKeys()
      .then((names) => {
        const result = new Map<string, Set<string>>();
        for (const name of names) {
          const info = parseSlot(name);
          if (!info) continue;
          const found = result.get(info.logical) ?? new Set<string>();
          found.add(name);
          result.set(info.logical, found);
        }
        return result;
      })
      .catch((error) => {
        inventoryPromise = null;
        throw error;
      }));
  }
  async function read(key: string) {
    verified.delete(key);
    for (let attempt = 0; attempt < 2; attempt++) {
      const stored = await raw.getItem(key);
      if (stored === null) return null;
      if (!key.startsWith(LOGICAL_PREFIX)) return stored;
      const info = header(stored);
      if (!info) return stored;
      try {
        const names = Array.from({ length: info.count }, (_, index) =>
          slot(key, index),
        );
        const rows = await raw.multiGet(names);
        const values = new Map(rows);
        if (rows.length !== info.count || values.size !== info.count) bad();
        const pieces = names.map((name) => {
          const value = values.get(name);
          if (typeof value !== "string" || !value.length) return bad();
          split(value, CHUNK_BYTES, "localData");
          return value;
        });
        const value = pieces.join("");
        const measured = split(value, MAX_READ_BYTES, "localData");
        if (
          value.length !== info.length ||
          measured.bytes !== info.bytes ||
          (await digest(value)) !== info.sha256
        )
          bad();
        verified.set(key, stored);
        return value;
      } catch (error) {
        // A dev reload can overlap a previous JS context. Never fall back to
        // older chunks; retry only if the authoritative header really changed.
        const latest = await raw.getItem(key).catch(() => stored);
        if (attempt === 0 && latest !== stored) continue;
        throw nativeError(error, "localData");
      }
    }
    return bad();
  }
  async function slots(key: string) {
    return (await raw.getAllKeys()).filter(
      (name) => parseSlot(name)?.logical === key,
    );
  }
  async function cleanup(key: string, count: number, committed: string) {
    const known = await inventory();
    const names = known.get(key) ?? new Set<string>();
    for (let index = 0; index < count; index++) names.add(slot(key, index));
    known.set(key, names);
    const obsolete = [...names].filter(
      (name) => parseSlot(name)!.index >= count,
    );
    if (!obsolete.length) return;
    // Production has one JS writer. This additional guard avoids cleanup after
    // an already observed dev-reload write; it is not cross-process locking.
    if ((await raw.getItem(key)) !== committed) return;
    await raw.multiRemove(obsolete);
    for (const name of obsolete) names.delete(name);
    if (!names.size) known.delete(key);
  }
  return {
    getItem(key: string) {
      return serial(raw, key, async () => {
        encoded(key);
        try {
          return await read(key);
        } catch (error) {
          throw nativeError(error, "localData");
        }
      });
    },
    setItem(key: string, value: string) {
      return serial(raw, key, async () => {
        encoded(key);
        if (!key.startsWith(LOGICAL_PREFIX)) {
          await raw.multiSet([[key, value]]);
          return;
        }
        if (value.startsWith(MARKER_FAMILY))
          throw new UserFacingError("operation");
        const { chunks, bytes } = split(
          value,
          MAX_CHUNK_VALUE_BYTES,
          "storageValueTooLarge",
        );
        // OfflineLibrary reads before every mutation. Avoid rehashing that same
        // committed header twice, while cold/changed/corrupt data is verified.
        const previous = await raw.getItem(key);
        if (
          previous !== null &&
          header(previous) &&
          verified.get(key) !== previous
        )
          await read(key);
        const count = bytes > CHUNK_BYTES ? chunks.length : 0;
        const pairs: [string, string][] = [];
        if (count) {
          const sha256 = await digest(value);
          if (!/^[a-f0-9]{64}$/.test(sha256))
            throw new UserFacingError("operation");
          chunks.forEach((part, index) => pairs.push([slot(key, index), part]));
          pairs.push([
            key,
            CHUNK_MARKER +
              JSON.stringify({ count, length: value.length, bytes, sha256 }),
          ]);
        } else pairs.push([key, value]);
        try {
          await raw.multiSet(pairs);
        } catch (error) {
          if (isFull(error)) throw new UserFacingError("storageFull");
          throw nativeError(error, "operation");
        }
        // Committed data is durable even if reclaiming stale high slots fails.
        // Keep cleanup inside this lock and the caller's pending-write lifetime.
        verified.delete(key);
        await cleanup(key, count, pairs[pairs.length - 1][1]).catch(
          () => undefined,
        );
      });
    },
    removeItem(key: string) {
      return serial(raw, key, async () => {
        encoded(key);
        try {
          await raw.multiRemove([key, ...(await slots(key))]);
        } catch (error) {
          throw nativeError(error, "operation");
        }
        verified.delete(key);
        void inventoryPromise
          ?.then((known) => known.delete(key))
          .catch(() => undefined);
      });
    },
    async getAllKeys() {
      const keys = await raw.getAllKeys();
      const logical = new Set(
        keys.filter((key) => !key.startsWith(CHUNK_PREFIX)),
      );
      for (const key of keys) {
        const chunk = parseSlot(key);
        if (chunk) logical.add(chunk.logical);
      }
      // Header-less chunk owners remain discoverable for explicit account purge.
      return [...logical];
    },
  };
}
