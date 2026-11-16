import { afterEach, expect, it, vi } from "vitest";
import { DraftWriter, waitForDraftWrites } from "../src/lib/draft-writer";

afterEach(() => vi.useRealTimers());

it("writes only the latest edit and flushes immediately on exit", async () => {
  vi.useFakeTimers();
  const storage = {
    write: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const writer = new DraftWriter("draft", storage, vi.fn());
  writer.schedule("a");
  writer.schedule("ab");
  expect(storage.write).not.toHaveBeenCalled();
  await writer.flush();
  expect(storage.write).toHaveBeenCalledExactlyOnceWith("draft", "ab");
  await vi.runAllTimersAsync();
  expect(storage.write).toHaveBeenCalledTimes(1);
});

it("never recreates a saved draft when an in-flight write finishes", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const storage = {
    write: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const writer = new DraftWriter("draft", storage, vi.fn());
  writer.schedule("old");
  const writing = writer.flush();
  await vi.waitFor(() => expect(storage.write).toHaveBeenCalledOnce());
  writer.schedule("latest");
  const discarding = writer.discard();
  expect(storage.remove).not.toHaveBeenCalled();
  finish();
  await writing;
  await discarding;
  writer.schedule("stale unmount effect");
  await writer.flush();
  await vi.runAllTimersAsync();
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(storage.remove).toHaveBeenCalledExactlyOnceWith("draft");
});

it("reports storage errors without blocking a later edit", async () => {
  const failure = new Error("disk full");
  const storage = {
    write: vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const onError = vi.fn();
  const writer = new DraftWriter("draft", storage, onError);
  writer.schedule("first");
  await writer.flush();
  expect(onError).toHaveBeenCalledWith(failure);
  writer.schedule("retry");
  await writer.flush();
  expect(storage.write).toHaveBeenLastCalledWith("draft", "retry");
});

it("orders writes from a reopened screen and waits before reading", async () => {
  let finish!: () => void;
  let saved = "";
  const storage = {
    write: vi.fn(async (_key: string, value: unknown) => {
      if (value === "old")
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      saved = String(value);
    }),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const oldScreen = new DraftWriter("chat", storage, vi.fn());
  oldScreen.schedule("old");
  void oldScreen.flush();
  await vi.waitFor(() => expect(storage.write).toHaveBeenCalledOnce());
  const reopened = new DraftWriter("chat", storage, vi.fn());
  reopened.schedule("new");
  void reopened.flush();
  const read = vi.fn(() => saved);
  const loading = waitForDraftWrites(storage, "chat").then(read);
  expect(read).not.toHaveBeenCalled();
  expect(storage.write).toHaveBeenCalledTimes(1);
  finish();
  await expect(loading).resolves.toBe("new");
  expect(storage.write).toHaveBeenCalledTimes(2);
});

it("clears only the committed snapshot and preserves a newer queued write", async () => {
  let current = "submitted";
  let release!: () => void;
  const read = vi.fn(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return current;
  });
  const storage = {
    write: vi.fn(async (_key: string, value: unknown) => {
      current = String(value);
    }),
    remove: vi.fn(async () => {
      current = "";
    }),
  };
  const old = new DraftWriter<string>("draft", storage, vi.fn());
  const cleanup = old.discardIfUnchanged(
    read,
    (value) => value === "submitted",
  );
  await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
  const reopened = new DraftWriter<string>("draft", storage, vi.fn());
  reopened.schedule("new work");
  const newerWrite = reopened.flush();
  expect(storage.write).not.toHaveBeenCalled();
  release();
  await expect(cleanup).resolves.toBe(true);
  await newerWrite;
  expect(current).toBe("new work");
});

it("keeps a newer persisted draft when an earlier save completes", async () => {
  const storage = { write: vi.fn(), remove: vi.fn() };
  const old = new DraftWriter<string>("draft", storage, vi.fn());
  await expect(
    old.discardIfUnchanged(
      async () => "new work",
      (value) => value === "submitted",
    ),
  ).resolves.toBe(false);
  expect(storage.remove).not.toHaveBeenCalled();
});

it("a failed conditional read does not prevent a newer queued edit from saving", async () => {
  let reject!: (error: Error) => void;
  const read = vi.fn(
    () =>
      new Promise<string>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const storage = {
    write: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  };
  const old = new DraftWriter<string>("draft", storage, vi.fn());
  const cleanup = old.discardIfUnchanged(
    read,
    (value) => value === "submitted",
  );
  const failure = expect(cleanup).rejects.toThrow("Fixture read failure");
  await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
  const reopened = new DraftWriter<string>("draft", storage, vi.fn());
  reopened.schedule("new work");
  const newerWrite = reopened.flush();
  reject(new Error("Fixture read failure"));
  await failure;
  await newerWrite;
  expect(storage.write).toHaveBeenCalledExactlyOnceWith("draft", "new work");
  expect(storage.remove).not.toHaveBeenCalled();
});

it("a reopened reader recovers the retained draft after failed cleanup", async () => {
  let reject!: (error: Error) => void;
  const storage = {
    write: vi.fn(),
    remove: vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    ),
  };
  const writer = new DraftWriter<string>("draft", storage, vi.fn());
  const cleanup = writer.discard();
  const failure = expect(cleanup).rejects.toThrow("Fixture cleanup failure");
  await vi.waitFor(() => expect(storage.remove).toHaveBeenCalledOnce());
  const read = vi.fn(() => "retained work");
  const loading = waitForDraftWrites(storage, "draft").then(read);
  expect(read).not.toHaveBeenCalled();
  reject(new Error("Fixture cleanup failure"));
  await failure;
  await expect(loading).resolves.toBe("retained work");
});

it("strict flush reports persistence failure while ordinary flush retains its error callback", async () => {
  const failure = new Error("synthetic disk full");
  const storage = {
    write: vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined),
    remove: vi.fn(),
  };
  const onError = vi.fn();
  const writer = new DraftWriter<string>("draft", storage, onError);
  writer.schedule("retained text");
  await expect(writer.flushOrThrow()).rejects.toBe(failure);
  expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
  writer.schedule("retained text");
  await expect(writer.flushOrThrow()).resolves.toBeUndefined();
  expect(storage.write).toHaveBeenCalledTimes(2);
});

it("strict flush waits for an already pending debounced write without duplicating it", async () => {
  let finish!: () => void;
  const storage = {
    write: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
    remove: vi.fn(),
  };
  const writer = new DraftWriter<string>("draft", storage, vi.fn());
  writer.schedule("saved text");
  void writer.flush();
  await vi.waitFor(() => expect(storage.write).toHaveBeenCalledOnce());
  const done = vi.fn();
  const strict = writer.flushOrThrow().then(done);
  expect(done).not.toHaveBeenCalled();
  finish();
  await strict;
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(done).toHaveBeenCalledOnce();
});

it("retires a superseded writer without deleting or recreating another context's draft", async () => {
  vi.useFakeTimers();
  const storage = {
    write: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const writer = new DraftWriter("draft", storage, vi.fn());
  writer.schedule("stale queued edit");
  writer.retire();
  writer.schedule("later stale edit");
  await vi.runAllTimersAsync();
  await writer.flush();
  expect(storage.write).not.toHaveBeenCalled();
  expect(storage.remove).not.toHaveBeenCalled();
});

it("retiring skips a queued write waiting for the previous context", async () => {
  let release!: () => void;
  const storage = {
    write: vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined),
    remove: vi.fn(),
  };
  const previous = new DraftWriter<string>("draft", storage, vi.fn());
  previous.schedule("already started");
  const first = previous.flush();
  await vi.waitFor(() => expect(storage.write).toHaveBeenCalledTimes(1));
  const stale = new DraftWriter<string>("draft", storage, vi.fn());
  stale.schedule("queued stale update");
  const second = stale.flush();
  stale.retire();
  release();
  await Promise.all([first, second]);
  expect(storage.write).toHaveBeenCalledExactlyOnceWith(
    "draft",
    "already started",
  );
  expect(storage.remove).not.toHaveBeenCalled();
});

it("retiring cannot cancel an already started write and never deletes its value", async () => {
  let release!: () => void;
  const storage = {
    write: vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    ),
    remove: vi.fn(),
  };
  const writer = new DraftWriter<string>("draft", storage, vi.fn());
  writer.schedule("already started");
  const pending = writer.flush();
  await vi.waitFor(() => expect(storage.write).toHaveBeenCalledTimes(1));
  writer.retire();
  release();
  await pending;
  writer.schedule("later update");
  await writer.flush();
  expect(storage.write).toHaveBeenCalledExactlyOnceWith(
    "draft",
    "already started",
  );
  expect(storage.remove).not.toHaveBeenCalled();
});
