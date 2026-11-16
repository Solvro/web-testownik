import { expect, it, vi } from "vitest";
import { createIndexedDBDeletionMarkers } from "../src/lib/indexeddb-deletion-markers";

function harness() {
  const openings: Record<string, unknown>[] = [];
  const transactions: Record<string, unknown>[] = [];
  const requests: Record<string, unknown>[] = [];
  const close = vi.fn();
  const factory = {
    open: vi.fn(() => {
      const opening = {};
      openings.push(opening);
      return opening;
    }),
  };
  const store = {
    getAllKeys: vi.fn(() => nextRequest()),
    put: vi.fn(() => nextRequest()),
    delete: vi.fn(() => nextRequest()),
  };
  function nextRequest() {
    const request = { result: undefined, error: null };
    requests.push(request);
    return request;
  }
  const db = {
    close,
    objectStoreNames: { contains: () => true },
    transaction: vi.fn(() => {
      const tx = { objectStore: () => store, error: null };
      transactions.push(tx);
      return tx;
    }),
  };
  const markers = createIndexedDBDeletionMarkers(
    () => factory as unknown as IDBFactory,
  );
  async function open() {
    await Promise.resolve();
    await Promise.resolve();
    const opening = openings.at(-1)!;
    opening.result = db;
    const before = requests.length;
    (opening.onsuccess as () => void)();
    const created = requests.slice(before);
    for (const request of created) request.result = [];
    return {
      tx: transactions.at(-1)!,
      request: created[0]!,
      requests: created,
      succeed: () => {
        for (const request of created) (request.onsuccess as () => void)();
      },
    };
  }
  return { markers, open, openings, factory, close, store, db };
}

it("waits for transaction completion after request success before acknowledging intent", async () => {
  const f = harness();
  const completed = vi.fn();
  const write = f.markers.write("owner").then(completed);
  const { tx, request, succeed } = await f.open();
  request.result = "owner";
  succeed();
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  expect(f.close).not.toHaveBeenCalled();
  (tx.oncomplete as () => void)();
  await write;
  expect(completed).toHaveBeenCalledOnce();
  expect(f.store.put).toHaveBeenCalledWith(true, "owner");
  expect(f.db.transaction).toHaveBeenCalledWith(["pending"], "readwrite", {
    durability: "strict",
  });
  expect(f.close).toHaveBeenCalledOnce();
});

it("rejects an abort after request success and permits a fresh retry", async () => {
  const f = harness();
  const write = f.markers.write("owner");
  const rejected = expect(write).rejects.toMatchObject({ code: "operation" });
  const { tx, succeed } = await f.open();
  succeed();
  (tx.onabort as () => void)();
  await rejected;
  const retry = f.markers.list();
  const next = await f.open();
  next.request.result = ["owner", "another-owner"];
  next.succeed();
  (next.tx.oncomplete as () => void)();
  expect(await retry).toEqual(["owner", "another-owner"]);
  expect(f.factory.open).toHaveBeenCalledTimes(2);
});

it("reports quota failure without acknowledging a write", async () => {
  const f = harness();
  const writing = f.markers.write("owner");
  const rejected = expect(writing).rejects.toMatchObject({
    code: "storageFull",
  });
  const { tx } = await f.open();
  tx.error = { name: "QuotaExceededError" };
  (tx.onabort as () => void)();
  await rejected;
});

it("does not acknowledge transaction completion without request success", async () => {
  const f = harness();
  const writing = f.markers.write("owner");
  const rejected = expect(writing).rejects.toMatchObject({ code: "operation" });
  const { tx } = await f.open();
  (tx.oncomplete as () => void)();
  await rejected;
});

it("rejects an unavailable browser store instead of returning an empty marker scan", async () => {
  const markers = createIndexedDBDeletionMarkers(() => undefined);
  expect(markers.supported).toBe(false);
  await expect(markers.list()).rejects.toMatchObject({ code: "operation" });
});

it("preserves unsupported status when browser access itself throws", async () => {
  const markers = createIndexedDBDeletionMarkers(() => {
    throw new Error("Browser storage denied");
  });
  expect(markers.supported).toBe(false);
  await expect(markers.list()).rejects.toMatchObject({ code: "operation" });
});

it("rejects unknown key shapes instead of silently losing marker intent", async () => {
  const f = harness();
  const scan = f.markers.list();
  const rejected = expect(scan).rejects.toMatchObject({ code: "operation" });
  const { tx, request, succeed } = await f.open();
  request.result = ["known-owner", 7];
  succeed();
  (tx.oncomplete as () => void)();
  await rejected;
});

it("closes a late successful open after a blocked attempt has already failed", async () => {
  const f = harness();
  const scan = f.markers.list();
  const rejected = expect(scan).rejects.toMatchObject({ code: "operation" });
  await Promise.resolve();
  await Promise.resolve();
  (f.openings[0].onblocked as () => void)();
  await rejected;
  await f.open();
  expect(f.close).toHaveBeenCalledOnce();
  expect(f.store.getAllKeys).not.toHaveBeenCalled();
});

it("removes only the specified owner and acknowledges only transaction completion", async () => {
  const f = harness();
  const removing = f.markers.remove("owner");
  const { tx, succeed } = await f.open();
  succeed();
  expect(f.store.delete).toHaveBeenCalledWith("owner");
  (tx.oncomplete as () => void)();
  await removing;
});

it("bounds a read whose database open never settles and closes its late connection", async () => {
  vi.useFakeTimers();
  try {
    const f = harness();
    const rejected = expect(f.markers.list()).rejects.toMatchObject({
      code: "operation",
    });
    await vi.advanceTimersByTimeAsync(8000);
    await rejected;
    await f.open();
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.store.getAllKeys).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("starts and bounds a read even while an earlier mutation transaction is hung", async () => {
  vi.useFakeTimers();
  try {
    const f = harness();
    const writing = expect(f.markers.write("owner")).rejects.toMatchObject({
      code: "operation",
    });
    const mutation = await f.open();
    const reading = expect(f.markers.list()).rejects.toMatchObject({
      code: "operation",
    });
    expect(f.factory.open).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8000);
    await reading;
    // A read deadline never releases or acknowledges an active write.
    expect(f.close).not.toHaveBeenCalled();
    (mutation.tx.onabort as () => void)();
    await writing;
    expect(f.close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
