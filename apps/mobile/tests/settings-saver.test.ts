import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserSettings } from "@testownik/core/user/types";
import { createSettingsSaver, settingsSaver } from "../src/lib/settings-saver";

const base: UserSettings = {
  initial_reoccurrences: 1,
  wrong_answer_reoccurrences: 1,
  max_question_reoccurrences: 5,
  ai_disabled: false,
  default_ai_model: null,
  notify_quiz_shared: true,
  notify_bug_reported: true,
  notify_marketing: false,
};
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const session = new AbortController();
  const save = vi.fn(async (value: UserSettings) => value);
  const commit = vi.fn((_value: UserSettings) => {});
  const cancel = vi.fn(async () => {});
  const report = vi.fn();
  const saver = createSettingsSaver(session.signal, {
    save,
    cancel,
    commit,
    report,
  });
  return { session, save, cancel, commit, report, saver };
}
afterEach(() => vi.useRealTimers());

describe("session settings saver", () => {
  it("keeps the pending edit across subscribers and serializes the next full snapshot", async () => {
    vi.useFakeTimers();
    const { saver, save, commit, report } = fixture();
    const held = deferred<UserSettings>();
    save.mockImplementationOnce(() => held.promise);
    const leave = saver.subscribe(vi.fn());
    saver.update(base, { initial_reoccurrences: 2 });
    const first = saver.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledTimes(1);
    leave();
    const stop = saver.subscribe(vi.fn());
    expect(saver.getSnapshot().draft?.initial_reoccurrences).toBe(2);
    saver.update(base, { wrong_answer_reoccurrences: 2 });
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    held.resolve(save.mock.calls[0][0]);
    await first;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({
      initial_reoccurrences: 2,
      wrong_answer_reoccurrences: 2,
    });
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenLastCalledWith(save.mock.calls[1][0]);
    expect(saver.getSnapshot()).toEqual({
      draft: null,
      error: null,
      busy: false,
    });
    expect(report).not.toHaveBeenCalled();
    stop();
  });

  it("does not resend a snapshot when its screen closes during the request", async () => {
    const { saver, save } = fixture();
    const held = deferred<UserSettings>();
    save.mockImplementationOnce(() => held.promise);
    saver.update(base, { initial_reoccurrences: 2 });
    const first = saver.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(saver.flush()).toBe(first);
    held.resolve(save.mock.calls[0][0]);
    await first;
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("retains failed drafts and the error for a reopened screen to retry", async () => {
    const { saver, save, report } = fixture();
    const error = new Error("offline");
    save.mockRejectedValueOnce(error);
    saver.update(base, { initial_reoccurrences: 2 });
    await saver.flush();
    expect(report).toHaveBeenCalledExactlyOnceWith(error);
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    const stop = saver.subscribe(vi.fn());
    expect(saver.getSnapshot()).toMatchObject({
      draft: { initial_reoccurrences: 2 },
      error,
      busy: false,
    });
    await saver.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.getSnapshot()).toEqual({
      draft: null,
      error: null,
      busy: false,
    });
    expect(report).toHaveBeenCalledTimes(1);
    stop();
  });

  it.each([false, true])(
    "reports only the final failure after a superseded failure, finalFailure=%s",
    async (finalFailure) => {
      const { saver, save, report } = fixture();
      const first = deferred<UserSettings>();
      const lastError = new Error("latest failed");
      save.mockImplementationOnce(() => first.promise);
      if (finalFailure) save.mockRejectedValueOnce(lastError);
      saver.update(base, { initial_reoccurrences: 2 });
      const pending = saver.flush();
      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      saver.update(base, { initial_reoccurrences: 3 });
      void saver.flush();
      first.reject(new Error("superseded"));
      await pending;
      expect(save).toHaveBeenCalledTimes(2);
      if (finalFailure) {
        expect(report).toHaveBeenCalledExactlyOnceWith(lastError);
        expect(saver.getSnapshot().draft?.initial_reoccurrences).toBe(3);
      } else expect(report).not.toHaveBeenCalled();
    },
  );

  it("does not skip the debounce for an edit made while a short save is running", async () => {
    vi.useFakeTimers();
    const { saver, save } = fixture();
    const first = deferred<UserSettings>();
    save.mockImplementationOnce(() => first.promise);
    saver.update(base, { initial_reoccurrences: 2 });
    const pending = saver.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    saver.update(base, { initial_reoccurrences: 3 });
    first.resolve(save.mock.calls[0][0]);
    await pending;
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(599);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.getSnapshot().draft).toBeNull();
  });

  it("does not clear an edit made while the acknowledgement is committing", async () => {
    const { saver, save, cancel } = fixture();
    const committing = deferred<void>();
    cancel
      .mockResolvedValueOnce()
      .mockImplementationOnce(() => committing.promise);
    saver.update(base, { initial_reoccurrences: 2 });
    const pending = saver.flush();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
    saver.update(base, { wrong_answer_reoccurrences: 2 });
    void saver.flush();
    committing.resolve();
    await pending;
    expect(save.mock.calls[1][0]).toMatchObject({
      initial_reoccurrences: 2,
      wrong_answer_reoccurrences: 2,
    });
    expect(saver.getSnapshot().draft).toBeNull();
  });

  it("disposes pending data on logout and ignores a late old-session result", async () => {
    const { session, saver, save, commit, report } = fixture();
    const held = deferred<UserSettings>();
    save.mockImplementationOnce(() => held.promise);
    saver.update(base, { initial_reoccurrences: 2 });
    const pending = saver.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    session.abort();
    expect(saver.getSnapshot()).toEqual({
      draft: null,
      error: null,
      busy: false,
    });
    held.resolve(save.mock.calls[0][0]);
    await pending;
    saver.update(base, { initial_reoccurrences: 3 });
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("cancels the debounce on logout and reports no aborted-session rejection", async () => {
    vi.useFakeTimers();
    const { session, saver, save, report } = fixture();
    saver.update(base, { initial_reoccurrences: 2 });
    session.abort();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("recovers from a synchronously thrown save without leaving the chain stuck", async () => {
    const { saver, save } = fixture();
    save.mockImplementationOnce(() => {
      throw new Error("synchronous failure");
    });
    const stop = saver.subscribe(vi.fn());
    saver.update(base, { initial_reoccurrences: 2 });
    await saver.flush();
    await saver.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.getSnapshot().draft).toBeNull();
    stop();
  });

  it("shares a saver only inside the same login", () => {
    const ports = {
      save: async (value: UserSettings) => value,
      cancel: async () => {},
      commit: () => {},
      report: vi.fn(),
    };
    const first = new AbortController(),
      next = new AbortController();
    expect(settingsSaver(first.signal, ports)).toBe(
      settingsSaver(first.signal, ports),
    );
    expect(settingsSaver(next.signal, ports)).not.toBe(
      settingsSaver(first.signal, ports),
    );
  });
});

it("does not commit or report when logout occurs while cancelling the old GET after ACK", async () => {
  const { saver, session, cancel, commit, report } = fixture();
  const held = deferred<void>();
  cancel.mockResolvedValueOnce().mockImplementationOnce(() => held.promise);
  saver.update(base, { initial_reoccurrences: 2 });
  const pending = saver.flush();
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
  session.abort();
  held.resolve();
  await pending;
  expect(commit).not.toHaveBeenCalled();
  expect(report).not.toHaveBeenCalled();
  expect(saver.getSnapshot()).toEqual({
    draft: null,
    error: null,
    busy: false,
  });
});

it.each(["cancel", "commit"] as const)(
  "a local %s failure after server ACK never reports an unsaved change",
  async (phase) => {
    const { saver, cancel, commit, report, save } = fixture();
    if (phase === "cancel")
      cancel
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error("cache cancellation failed"));
    else
      commit.mockImplementationOnce(() => {
        throw new Error("cache write failed");
      });
    saver.update(base, { initial_reoccurrences: 2 });
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.getSnapshot()).toEqual({
      draft: null,
      error: null,
      busy: false,
    });
    expect(report).not.toHaveBeenCalled();
  },
);

it("commits the first successful ACK even if the newer snapshot later fails", async () => {
  const { saver, save, commit, report } = fixture();
  const held = deferred<UserSettings>(),
    error = new Error("latest failure");
  save.mockImplementationOnce(() => held.promise).mockRejectedValueOnce(error);
  saver.update(base, { initial_reoccurrences: 2 });
  const pending = saver.flush();
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  saver.update(base, { initial_reoccurrences: 3 });
  void saver.flush();
  held.resolve(save.mock.calls[0][0]);
  await pending;
  expect(commit).toHaveBeenCalledExactlyOnceWith(save.mock.calls[0][0]);
  expect(saver.getSnapshot()).toMatchObject({
    draft: { initial_reoccurrences: 3 },
    error,
  });
  expect(report).toHaveBeenCalledExactlyOnceWith(error);
});

it("keeps mounted failures inline and reports an explicit retry failure after leaving", async () => {
  const { saver, save, report } = fixture();
  save.mockRejectedValue(new Error("failed"));
  const leave = saver.subscribe(vi.fn());
  saver.update(base, { initial_reoccurrences: 2 });
  await saver.flush();
  expect(report).not.toHaveBeenCalled();
  leave();
  await saver.retry();
  expect(report).toHaveBeenCalledTimes(1);
});

it("a debounce failure retains its draft when the notification itself throws", async () => {
  vi.useFakeTimers();
  const { saver, save, report } = fixture();
  save.mockRejectedValue(new Error("offline"));
  report.mockImplementation(() => {
    throw new Error("cannot present alert");
  });
  saver.update(base, { initial_reoccurrences: 2 });
  await vi.advanceTimersByTimeAsync(600);
  expect(report).toHaveBeenCalledTimes(1);
  expect(saver.getSnapshot()).toMatchObject({
    draft: { initial_reoccurrences: 2 },
    busy: false,
  });
  expect(saver.getSnapshot().error).toBeInstanceOf(Error);
});

it("uses the reopened screen's cache and reporter without replacing the in-flight save", async () => {
  const { saver, save, commit, report } = fixture();
  const held = deferred<UserSettings>();
  save.mockImplementationOnce(() => held.promise);
  saver.update(base, { initial_reoccurrences: 2 });
  const pending = saver.flush();
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  const nextCommit = vi.fn(),
    nextReport = vi.fn(),
    error = new Error("new context failed");
  const nextSave = vi.fn(
    async (_value: UserSettings): Promise<UserSettings> => {
      throw error;
    },
  );
  saver.configure({
    save: nextSave,
    cancel: async () => {},
    commit: nextCommit,
    report: nextReport,
  });
  held.resolve(save.mock.calls[0][0]);
  await pending;
  expect(commit).not.toHaveBeenCalled();
  expect(nextCommit).toHaveBeenCalledTimes(1);
  saver.update(base, { initial_reoccurrences: 3 });
  await saver.flush();
  expect(nextSave).toHaveBeenCalledTimes(1);
  expect(nextReport).toHaveBeenCalledExactlyOnceWith(error);
  expect(report).not.toHaveBeenCalled();
});
