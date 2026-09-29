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
  await Promise.resolve();
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
  await Promise.resolve();
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
