import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Tokens } from "./client";
import { createAndroidChunkStorage } from "./android-chunk-storage";
import { createTokenStore } from "./token-store";
import { withProfileOwnership } from "./profile-token-store";
import {
  externalDeletionMarkers,
  type DeletionMarkerSnapshot,
} from "./deletion-markers";
import {
  withAccountDataLock,
  withOfflineDataLock,
  withQuizCreateLock,
} from "./account-data-lock";
import { UserFacingError } from "./user-error";
import { isAccountDataKey, purgeAccountData } from "./account-data";

const localStore =
  Platform.OS === "android"
    ? createAndroidChunkStorage(AsyncStorage, (value) =>
        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
      )
    : AsyncStorage;

const key = "testownik.oauth-session.v2";
const legacyKey = "testownik.session.v1";
const profileKey = "testownik.v1.last-user";
const tabProfileStore = {
  async getItem(key: string) {
    return sessionStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    sessionStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    sessionStorage.removeItem(key);
  },
};
function valueStore(key: string) {
  return Platform.OS === "web" && key === "last-user"
    ? tabProfileStore
    : localStore;
}
const listeners = new Set<() => void>();
const deletedOwners = new Set<string>();
const durableDeletedOwners = new Set<string>();
const pendingWrites = new Set<{ key: string; promise: Promise<void> }>();
let lastUserOperations = Promise.resolve();
function mutateLastUser(run: () => Promise<void>) {
  const next = lastUserOperations.then(run);
  lastUserOperations = next.catch(() => undefined);
  return next;
}
let deletionMarkers: Promise<void> | null = null;
const pendingPrefix = "testownik.v1.account-deletion.";
const completedPrefix = "testownik.v1.account-deleted.";
async function externalSnapshot(): Promise<DeletionMarkerSnapshot> {
  if (Platform.OS === "web" && externalDeletionMarkers.scan)
    return externalDeletionMarkers.scan();
  return { pending: await externalDeletionMarkers.list(), deleted: [] };
}
async function readDeletionSnapshot(): Promise<DeletionMarkerSnapshot> {
  const [primary, external] = await Promise.allSettled([
    localStore.getAllKeys(),
    externalSnapshot(),
  ]);
  const pending = new Set<string>(),
    deleted = new Set<string>();
  if (primary.status === "fulfilled")
    for (const key of primary.value) {
      if (key.startsWith(pendingPrefix))
        pending.add(key.slice(pendingPrefix.length));
      if (Platform.OS === "web" && key.startsWith(completedPrefix))
        deleted.add(key.slice(completedPrefix.length));
    }
  if (external.status === "fulfilled") {
    for (const owner of external.value.pending) pending.add(owner);
    for (const owner of external.value.deleted) deleted.add(owner);
  }
  const newlyVerified: string[] = [];
  for (const owner of new Set([...pending, ...deleted])) {
    deletedOwners.add(owner);
    if (!durableDeletedOwners.has(owner)) newlyVerified.push(owner);
    durableDeletedOwners.add(owner);
  }
  // A blocked autosave can discover deletion even when browser notifications
  // were lost. Mark every known owner before callbacks can reenter storage.
  // Never await cleanup from a scan that may hold the private-write leaf lock.
  if (Platform.OS === "web" && newlyVerified.length)
    queueMicrotask(() => {
      for (const owner of newlyVerified) emitAccountDeletion(owner);
    });
  if (primary.status === "rejected")
    throw Platform.OS === "web"
      ? new UserFacingError("browserStorageCoordination")
      : primary.reason;
  if (external.status === "rejected")
    throw Platform.OS === "web"
      ? new UserFacingError("browserStorageCoordination")
      : external.reason;
  return { pending: [...pending], deleted: [...deleted] };
}
async function readDeletionMarkers() {
  return (await readDeletionSnapshot()).pending;
}
async function verifiedCompletedOwner(owner: string) {
  const [primary, external] = await Promise.allSettled([
    localStore.getItem(`${completedPrefix}${owner}`),
    externalSnapshot(),
  ]);
  const verified =
    (primary.status === "fulfilled" && primary.value !== null) ||
    (external.status === "fulfilled" && external.value.deleted.includes(owner));
  if (verified) {
    deletedOwners.add(owner);
    durableDeletedOwners.add(owner);
  }
  return verified;
}
const accountDeletionListeners = new Set<(owner: string) => void>();
let channel: BroadcastChannel | undefined;
const channelName = "testownik.account-deletions.v1";
function emitAccountDeletion(owner: string) {
  for (const listener of accountDeletionListeners) {
    try {
      listener(owner);
    } catch {
      /* A UI subscriber cannot undo durable intent or hide it from others. */
    }
  }
}
function broadcastAccountDeletion(owner: string) {
  emitAccountDeletion(owner);
  try {
    channel?.postMessage({ owner });
  } catch {
    /* Durable guards remain authoritative. */
  }
}
/** Signals are hints; verify durable ownership before notifying protected UI. */
export function subscribeAccountDeletion(listener: (owner: string) => void) {
  if (Platform.OS !== "web") return () => {};
  accountDeletionListeners.add(listener);
  const verify = async (owner?: string) => {
    try {
      await storage.accountDeletionOwners();
    } catch {
      /* Retain verified positive guards from partial scans. */
    }
    if (owner) {
      if (durableDeletedOwners.has(owner)) emitAccountDeletion(owner);
    } else for (const known of durableDeletedOwners) emitAccountDeletion(known);
  };
  const receive = (event: MessageEvent<unknown>) => {
    const value = event.data;
    if (
      value &&
      typeof value === "object" &&
      "owner" in value &&
      typeof value.owner === "string"
    )
      void verify(value.owner);
  };
  const changed = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key?.startsWith(pendingPrefix))
      void verify(event.key.slice(pendingPrefix.length));
    else if (event.key?.startsWith(completedPrefix))
      void verify(event.key.slice(completedPrefix.length));
    else if (event.key === null) void verify();
  };
  const foreground = () => {
    if (document.visibilityState === "visible") void verify();
  };
  try {
    channel ??= new BroadcastChannel(channelName);
    channel.addEventListener("message", receive);
  } catch {
    /* Storage/foreground signals still verify state. */
  }
  globalThis.addEventListener("storage", changed);
  document.addEventListener("visibilitychange", foreground);
  globalThis.addEventListener("focus", foreground);
  return () => {
    accountDeletionListeners.delete(listener);
    channel?.removeEventListener("message", receive);
    globalThis.removeEventListener("storage", changed);
    document.removeEventListener("visibilitychange", foreground);
    globalThis.removeEventListener("focus", foreground);
    if (accountDeletionListeners.size === 0) {
      channel?.close();
      channel = undefined;
    }
  };
}
function isPrivateWrite(key: string) {
  return (
    key === "last-user" ||
    key.startsWith("offline.") ||
    /^(?:draft|chat|chat-draft|quiz-ai-model|quiz-create)\./.test(key)
  );
}
function accountLock<T>(run: () => Promise<T>) {
  return Platform.OS === "web" ? withAccountDataLock(run) : run();
}
function loadDeletionMarkers() {
  return (deletionMarkers ??= readDeletionMarkers()
    .then(() => undefined)
    .catch((error) => {
      deletionMarkers = null;
      throw error;
    }));
}
// Web is a development preview. Native credentials live exclusively in Keychain/Keystore.
const persistedTokenStore = createTokenStore({
  async read() {
    if (Platform.OS === "web") sessionStorage.removeItem(legacyKey);
    else await SecureStore.deleteItemAsync(legacyKey);
    const raw =
      Platform.OS === "web"
        ? sessionStorage.getItem(key)
        : await SecureStore.getItemAsync(key);
    try {
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  async write(tokens) {
    if (Platform.OS === "web") {
      if (tokens) sessionStorage.setItem(key, JSON.stringify(tokens));
      else sessionStorage.removeItem(key);
    } else if (tokens)
      await SecureStore.setItemAsync(key, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(key);
  },
  changed() {
    listeners.forEach((fn) => fn());
  },
});
export const tokenStore =
  Platform.OS === "web"
    ? withProfileOwnership(persistedTokenStore, () =>
        sessionStorage.removeItem(profileKey),
      )
    : persistedTokenStore;
export function subscribeSession(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const storage = {
  withCreateTransaction<T>(owner: string, run: () => Promise<T>): Promise<T> {
    return Platform.OS === "web" ? withQuizCreateLock(owner, run) : run();
  },
  withOfflineTransaction<T>(run: () => Promise<T>): Promise<T> {
    return Platform.OS === "web" ? withOfflineDataLock(run) : run();
  },
  async keys() {
    return (await localStore.getAllKeys())
      .filter((key) => key.startsWith("testownik.v1."))
      .map((key) => key.slice("testownik.v1.".length));
  },
  async read<T>(key: string, fallback: T): Promise<T> {
    const raw = await valueStore(key).getItem(`testownik.v1.${key}`);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  /** Offline answers must never be replaced with an empty fallback on corruption. */
  async readStrict<T>(key: string, fallback: T): Promise<T> {
    const raw = await valueStore(key).getItem(`testownik.v1.${key}`);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new UserFacingError("localData");
    }
  },
  async write<T>(key: string, value: T, isCurrent?: () => boolean) {
    const write = async () => {
      if (Platform.OS === "web" && isPrivateWrite(key))
        await readDeletionSnapshot();
      else await loadDeletionMarkers();
      if (isCurrent && !isCurrent()) return;
      if ([...deletedOwners].some((owner) => isAccountDataKey(key, owner)))
        return;
      if (
        key === "last-user" &&
        value &&
        typeof value === "object" &&
        "id" in value &&
        deletedOwners.has(String(value.id))
      )
        return;
      await valueStore(key).setItem(
        `testownik.v1.${key}`,
        JSON.stringify(value),
      );
    };
    const guarded = () =>
      Platform.OS === "web" && isPrivateWrite(key)
        ? accountLock(write)
        : write();
    // Existing app queues are outermost; the cross-context lock is always a leaf.
    const promise = key === "last-user" ? mutateLastUser(guarded) : guarded();
    const pending = { key, promise };
    pendingWrites.add(pending);
    try {
      await promise;
    } finally {
      pendingWrites.delete(pending);
    }
  },
  async remove(key: string) {
    const remove = () => valueStore(key).removeItem(`testownik.v1.${key}`);
    if (key === "last-user") await mutateLastUser(() => accountLock(remove));
    else await remove();
  },
  async removeLastUser(ownerId: string) {
    await mutateLastUser(() =>
      accountLock(async () => {
        // Old shared browser profiles are never trusted for hydration. Explicit
        // owner cleanup can still erase a matching legacy profile, preserving B.
        const stores =
          Platform.OS === "web" ? [tabProfileStore, localStore] : [localStore];
        for (const store of stores) {
          const raw = await store.getItem(profileKey);
          if (raw === null) continue;
          let value: { id?: string } | null;
          try {
            value = JSON.parse(raw) as { id?: string } | null;
          } catch {
            // Damaged profiles cannot identify another owner and must not make
            // explicitly requested cleanup impossible to finish.
            await store.removeItem(profileKey);
            continue;
          }
          if (value?.id === ownerId) await store.removeItem(profileKey);
        }
      }),
    );
  },
  async purgeDeletedAccount(ownerId: string) {
    deletedOwners.add(ownerId);
    const web = Platform.OS === "web";
    // Completed deletion never becomes pending again merely because another
    // already-open tab needs its credentials or residual data cleared.
    const completed = web && (await verifiedCompletedOwner(ownerId));
    if (!completed) {
      try {
        // Record confirmed intent even when lock acquisition is unavailable.
        await localStore.setItem(`${pendingPrefix}${ownerId}`, "true");
        if ((await localStore.getItem(`${pendingPrefix}${ownerId}`)) !== "true")
          throw new UserFacingError("operation");
      } catch (primaryError) {
        if (externalDeletionMarkers.supported === false) throw primaryError;
        await externalDeletionMarkers.write(ownerId);
      }
    }
    if (web)
      await accountLock(async () => {
        try {
          await localStore.setItem(`${completedPrefix}${ownerId}`, "true");
          if (
            (await localStore.getItem(`${completedPrefix}${ownerId}`)) !==
            "true"
          )
            throw new UserFacingError("operation");
        } catch (primaryError) {
          if (
            !externalDeletionMarkers.writeDeleted ||
            externalDeletionMarkers.supported === false
          )
            throw primaryError;
          await externalDeletionMarkers.writeDeleted(ownerId);
        }
        // Every browser writer consults this transactional guard. A primary
        // marker remains recoverable if IDB cannot commit; do not erase then.
        if (!externalDeletionMarkers.writeDeleted)
          throw new UserFacingError("browserStorageCoordination");
        try {
          await externalDeletionMarkers.writeDeleted(ownerId);
        } catch {
          throw new UserFacingError("browserStorageCoordination");
        }
      });
    if (web && !completed) {
      durableDeletedOwners.add(ownerId);
      broadcastAccountDeletion(ownerId);
    }
    await Promise.allSettled(
      [...pendingWrites]
        .filter((entry) => isAccountDataKey(entry.key, ownerId))
        .map((entry) => entry.promise),
    );
    return purgeAccountData(this, ownerId);
  },
  async isAccountDeletionPending(ownerId: string) {
    let externalFailure: { error: unknown } | undefined;
    try {
      const external = await externalDeletionMarkers.list();
      for (const owner of external) deletedOwners.add(owner);
      if (external.includes(ownerId)) return true;
    } catch (error) {
      externalFailure = { error };
    }
    // Marker existence is intent, matching the enumeration path. A damaged
    // marker body cannot make an explicitly deleted owner usable again.
    if (
      (await localStore.getItem(`testownik.v1.account-deletion.${ownerId}`)) !==
      null
    ) {
      deletedOwners.add(ownerId);
      return true;
    }
    if (externalFailure) throw externalFailure.error;
    return false;
  },
  async pendingAccountDeletions() {
    return readDeletionMarkers();
  },
  async accountDeletionOwners() {
    const state = await readDeletionSnapshot();
    // A concurrently completed scan can verify deletion while this scan still
    // holds an older snapshot. Never forget that positive browser guard.
    return [
      ...new Set([
        ...state.pending,
        ...state.deleted,
        ...(Platform.OS === "web" ? durableDeletedOwners : []),
      ]),
    ];
  },
  async completeAccountDeletion(ownerId: string) {
    if (Platform.OS === "web") {
      try {
        if (!(await externalSnapshot()).deleted.includes(ownerId))
          throw new Error("Missing canonical guard");
      } catch {
        throw new UserFacingError("browserStorageCoordination");
      }
    }
    await this.remove(`account-deletion.${ownerId}`);
    await externalDeletionMarkers.remove(ownerId);
  },
};
