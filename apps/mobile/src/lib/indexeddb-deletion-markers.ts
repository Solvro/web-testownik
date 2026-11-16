import type {
  DeletionMarkerSnapshot,
  ExternalDeletionMarkers,
} from "./deletion-markers";
import { UserFacingError } from "./user-error";

const database = "testownik.account-deletion-markers.v1";
const pendingStore = "pending";
const deletedStore = "deleted";
function owners(keys: IDBValidKey[]): string[] {
  if (keys.some((key) => typeof key !== "string" || key.length === 0))
    throw new UserFacingError("operation");
  return keys as string[];
}

/** Independent browser intent and permanent, opaque deleted-owner guards. */
export function createIndexedDBDeletionMarkers(
  factory: () => IDBFactory | undefined,
): ExternalDeletionMarkers {
  let operations = Promise.resolve();
  function run<T>(
    mode: IDBTransactionMode,
    stores: string[],
    build: (tx: IDBTransaction) => { requests: IDBRequest[]; result: () => T },
  ) {
    const execute = () =>
      new Promise<T>((resolve, reject) => {
        let db: IDBDatabase | undefined,
          transaction: IDBTransaction | undefined,
          settled = false;
        // Read-only scans may be abandoned safely: no late mutation can outlive
        // the ownership lock. Mutation transactions settle only on complete/abort.
        const deadline =
          mode === "readonly"
            ? setTimeout(() => {
                try {
                  transaction?.abort();
                } catch {
                  /* Already inactive. */
                }
                fail();
              }, 8000)
            : undefined;
        const fail = (error?: DOMException | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          db?.close();
          reject(
            new UserFacingError(
              error?.name === "QuotaExceededError"
                ? "storageFull"
                : "operation",
            ),
          );
        };
        try {
          const idb = factory();
          if (!idb) {
            fail();
            return;
          }
          const opening = idb.open(database, 2);
          opening.onerror = () => fail(opening.error);
          opening.onblocked = () => fail();
          opening.onupgradeneeded = () => {
            if (settled) {
              opening.transaction?.abort();
              return;
            }
            const upgraded = opening.result,
              upgrade = opening.transaction!;
            if (!upgraded.objectStoreNames.contains(pendingStore))
              upgraded.createObjectStore(pendingStore);
            if (!upgraded.objectStoreNames.contains(deletedStore))
              upgraded.createObjectStore(deletedStore);
            // Existing v1 intent was written only after confirmed deletion. Keep
            // every pending key and add guards atomically in the version upgrade.
            const previous = upgrade.objectStore(pendingStore).getAllKeys();
            previous.onsuccess = () => {
              try {
                for (const owner of owners(previous.result))
                  upgrade.objectStore(deletedStore).put(true, owner);
              } catch {
                upgrade.abort();
              }
            };
          };
          opening.onsuccess = () => {
            db = opening.result;
            if (settled) {
              db.close();
              return;
            }
            db.onversionchange = () => db?.close();
            try {
              transaction = db.transaction(
                stores,
                mode,
                mode === "readwrite" ? { durability: "strict" } : undefined,
              );
              const tx = transaction;
              tx.onabort = () => fail(tx.error);
              const result = build(tx),
                successful = new Set<IDBRequest>();
              for (const request of result.requests)
                request.onsuccess = () => successful.add(request);
              tx.oncomplete = () => {
                if (settled) return;
                if (
                  result.requests.some(
                    (request) => !successful.has(request) || request.error,
                  )
                ) {
                  fail();
                  return;
                }
                try {
                  const value = result.result();
                  settled = true;
                  clearTimeout(deadline);
                  db?.close();
                  resolve(value);
                } catch {
                  fail();
                }
              };
            } catch {
              fail();
            }
          };
        } catch {
          fail();
        }
      });
    // A read's deadline starts immediately, even if an earlier mutation has
    // not settled. Browser transactions provide isolation; only mutations
    // need the additional same-module sequencing.
    const operation =
      mode === "readonly" ? execute() : operations.then(execute);
    if (mode !== "readonly")
      operations = operation.then(
        () => undefined,
        () => undefined,
      );
    return operation;
  }
  function scan(): Promise<DeletionMarkerSnapshot> {
    return run("readonly", [pendingStore, deletedStore], (tx) => {
      const pending = tx.objectStore(pendingStore).getAllKeys(),
        deleted = tx.objectStore(deletedStore).getAllKeys();
      return {
        requests: [pending, deleted],
        result: () => ({
          pending: owners(pending.result),
          deleted: owners(deleted.result),
        }),
      };
    });
  }
  return {
    get supported() {
      try {
        return factory() !== undefined;
      } catch {
        return false;
      }
    },
    scan,
    async list() {
      return (await scan()).pending;
    },
    async write(ownerId) {
      if (!ownerId) throw new UserFacingError("operation");
      await run("readwrite", [pendingStore], (tx) => {
        const pending = tx.objectStore(pendingStore).put(true, ownerId);
        return { requests: [pending], result: () => undefined };
      });
    },
    async writeDeleted(ownerId) {
      if (!ownerId) throw new UserFacingError("operation");
      await run("readwrite", [deletedStore], (tx) => {
        const request = tx.objectStore(deletedStore).put(true, ownerId);
        return { requests: [request], result: () => undefined };
      });
    },
    async remove(ownerId) {
      if (!ownerId) throw new UserFacingError("operation");
      await run("readwrite", [pendingStore], (tx) => {
        const request = tx.objectStore(pendingStore).delete(ownerId);
        return { requests: [request], result: () => undefined };
      });
    },
  };
}
