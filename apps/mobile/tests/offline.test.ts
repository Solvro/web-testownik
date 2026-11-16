import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { describe, expect, it, vi } from "vitest";

import { type ApiClient, ApiError } from "../src/lib/client";
import { OfflineLibrary, type PendingAnswer } from "../src/lib/offline";

const record = {
  id: "local",
  question: "q",
  selected_answers: ["a"],
  was_correct: true,
  answered_at: "2026-01-01",
};
const quiz = {
  id: "quiz",
  title: "Q",
  version: 1,
  questions: [],
  current_session: { id: "session", answers: [record] },
} as unknown as QuizWithUserProgress;
const item: PendingAnswer = {
  request_id: "idempotent",
  quiz_id: "quiz",
  session_id: "session",
  version: 1,
  question_id: "q",
  selected_answers: ["a"],
  elapsed_seconds: 12,
  next_question: null,
  local: record,
};
function nextAttempt(previous: QuizWithUserProgress, id: string) {
  const local = { ...record, id };
  return {
    item: { ...item, request_id: id, local },
    quiz: {
      ...previous,
      current_session: {
        ...previous.current_session!,
        answers: [...previous.current_session!.answers, local],
      },
    },
  };
}
function setup(post = vi.fn().mockResolvedValue({ ...record, id: "server" })) {
  const values = new Map<string, string>();
  const store = {
    read: async <T>(k: string, fallback: T): Promise<T> =>
      values.has(k) ? JSON.parse(values.get(k)!) : fallback,
    write: async (k: string, v: unknown) => {
      values.set(k, JSON.stringify(v));
    },
  };
  const api = { post } as unknown as ApiClient;
  return { library: new OfflineLibrary("u", store, api), store, api, post };
}
describe("offline answer persistence", () => {
  it("persists answers across restarts and acknowledges with server ID", async () => {
    const { library, store, api, post } = setup();
    await library.enqueue(item, quiz);
    const restarted = new OfflineLibrary("u", store, api);
    await restarted.sync();
    const state = await restarted.read();
    expect(state.queue).toHaveLength(0);
    expect(state.quizzes.quiz.current_session?.answers[0].id).toBe("server");
    expect(post.mock.calls[0][1].request_id).toBe(item.request_id);
  });
  it("keeps the same request ID after a lost response", async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValue({ ...record, id: "server" });
    const { library } = setup(post);
    await library.enqueue(item, quiz);
    await expect(library.sync()).rejects.toThrow();
    expect((await library.read()).queue).toHaveLength(1);
    await library.sync();
    expect(post.mock.calls[0][1]).toEqual(post.mock.calls[1][1]);
  });
  it("serializes simultaneous queue writes", async () => {
    const { library } = setup();
    await Promise.all([
      library.enqueue(item, quiz),
      library.enqueue(
        { ...item, request_id: "second", quiz_id: "second" },
        { ...quiz, id: "second" },
      ),
    ]);
    expect((await library.read()).queue).toHaveLength(2);
  });
  it("serializes updates from separate library instances using the same storage", async () => {
    const { library, store, api } = setup();
    const second = new OfflineLibrary("u", store, api);
    await Promise.all([
      library.cache(quiz),
      second.cache({ ...quiz, id: "second" }),
    ]);
    expect(Object.keys((await library.read()).quizzes).sort()).toEqual([
      "quiz",
      "second",
    ]);
  });
  it("retains conflicts and blocks later answers from the same quiz", async () => {
    const post = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "Session changed"));
    const { library } = setup(post);
    await library.enqueue(item, quiz);
    const second = nextAttempt(quiz, "second");
    await library.enqueue(second.item, second.quiz);
    await library.sync();
    expect(post).toHaveBeenCalledTimes(1);
    expect((await library.read()).errors.quiz).toBe("Session changed");
    expect((await library.read()).queue).toHaveLength(2);
  });
  it("does not overwrite pending local progress with a server fetch", async () => {
    const { library } = setup();
    await library.enqueue(item, quiz);
    await library.cache({ ...quiz, current_session: null });
    expect((await library.read()).quizzes.quiz.current_session).not.toBeNull();
  });
  it("retains synchronized local progress when an older GET finishes last", async () => {
    const { library, store, api } = setup();
    const refreshed = new OfflineLibrary("u", store, api);
    await library.cache({
      ...quiz,
      current_session: { ...quiz.current_session!, answers: [] },
    });
    const snapshot = refreshed.captureSnapshot(quiz.id, await refreshed.read());
    let finish!: (value: QuizWithUserProgress) => void;
    const response = new Promise<QuizWithUserProgress>((resolve) => {
      finish = resolve;
    });
    const fetching = response.then((value) => refreshed.cache(value, snapshot));
    await library.enqueue(item, quiz);
    await library.sync();
    finish({ ...quiz, current_session: null });
    const retained = await fetching;
    expect(retained?.current_session?.answers[0].id).toBe("server");
    expect((await library.read()).queue).toHaveLength(0);
    expect((await library.read()).quizzes.quiz).toEqual(retained);
  });
  it("keeps local progress when a stale GET finishes before its POST", async () => {
    let finish!: (value: unknown) => void;
    const post = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { library } = setup(post);
    const snapshot = library.captureSnapshot(quiz.id, await library.read());
    await library.enqueue(item, quiz);
    const syncing = library.sync();
    await vi.waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(
      (await library.cache({ ...quiz, current_session: null }, snapshot))
        ?.current_session?.answers[0].id,
    ).toBe("local");
    finish({ ...record, id: "server" });
    await syncing;
    expect(
      (await library.read()).quizzes.quiz.current_session?.answers[0].id,
    ).toBe("server");
  });
  it.each(["success", "conflict"])(
    "does not invalidate a fresh fetch when a discarded request finishes with %s",
    async (outcome) => {
      let finish!: (value: unknown) => void;
      let fail!: (error: Error) => void;
      const post = vi.fn(
        () =>
          new Promise((resolve, reject) => {
            finish = resolve;
            fail = reject;
          }),
      );
      const { library } = setup(post);
      await library.enqueue(item, quiz);
      const syncing = library.sync();
      await vi.waitFor(() => expect(post).toHaveBeenCalledOnce());
      await library.discard(quiz.id);
      const snapshot = library.captureSnapshot(quiz.id, await library.read());
      if (outcome === "success") finish({ ...record, id: "server" });
      else fail(new ApiError(409, "Session changed"));
      await syncing;
      expect(library.snapshot(quiz.id)).toBe(snapshot.localRevision);
      expect(await library.cache(quiz, snapshot)).toEqual(quiz);
    },
  );
  it("does not advance a snapshot after a failed storage write", async () => {
    const { library, store } = setup();
    const snapshot = library.captureSnapshot(quiz.id, await library.read());
    vi.spyOn(store, "write").mockRejectedValueOnce(new Error("Full storage"));
    await expect(library.enqueue(item, quiz)).rejects.toThrow("Full storage");
    expect(library.snapshot(quiz.id)).toBe(snapshot.localRevision);
    expect(await library.cache(quiz, snapshot)).toEqual(quiz);
  });
  it("does not resurrect a discarded quiz from an older GET", async () => {
    const { library } = setup();
    await library.cache(quiz);
    const snapshot = library.captureSnapshot(quiz.id, await library.read());
    await library.discard(quiz.id);
    expect(await library.cache(quiz, snapshot)).toBeUndefined();
    expect((await library.read()).quizzes).toEqual({});
  });
  it("keeps snapshot revisions scoped to a quiz and account", async () => {
    const { library, store, api } = setup();
    const snapshot = library.captureSnapshot(quiz.id, await library.read());
    await library.cache({ ...quiz, id: "other" });
    await new OfflineLibrary("other-user", store, api).cache(quiz);
    expect(await library.cache(quiz, snapshot)).toEqual(quiz);
  });
  it("retains rejected answers and prevents new answers until explicit recovery", async () => {
    const post = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "Session changed"));
    const { library } = setup(post);
    await library.enqueue(item, quiz);
    await library.sync();
    const before = await library.read();
    await expect(
      library.enqueue({ ...item, request_id: "additional" }, quiz),
    ).rejects.toMatchObject({ code: "syncConflict" });
    expect(await library.read()).toEqual(before);
    // A transient permission/session problem can still be retried explicitly.
    post.mockResolvedValue({ ...record, id: "server" });
    await library.sync();
    expect((await library.read()).errors).toEqual({});
    const next = nextAttempt((await library.read()).quizzes.quiz, "additional");
    await expect(
      library.enqueue(next.item, next.quiz),
    ).resolves.toBeUndefined();
  });
  it("isolates caches for different accounts", async () => {
    const { library, store, api } = setup();
    await library.enqueue(item, quiz);
    expect(
      (await new OfflineLibrary("other", store, api).read()).queue,
    ).toHaveLength(0);
  });
  it("does not overwrite an invalid persisted queue when caching a quiz", async () => {
    const { library, store } = setup();
    const damaged = { quizzes: { quiz }, queue: "unreadable", errors: {} };
    await store.write("offline.u", damaged);
    await expect(
      library.cache({ ...quiz, title: "Network refresh" }),
    ).rejects.toMatchObject({ code: "localData" });
    expect(await store.read("offline.u", null)).toEqual(damaged);
  });
  it.each([
    { session_id: null },
    { selected_answers: [null] },
    { elapsed_seconds: -1 },
    { elapsed_seconds: 3601 },
    { version: 1.5 },
    { next_question: {} },
    { local: null },
    { local: { ...record, was_correct: "true" } },
  ])(
    "retains malformed pending-answer fields without submitting or replacing them: %j",
    async (fields) => {
      const { library, store, post } = setup();
      const damaged = {
        quizzes: { quiz },
        queue: [{ ...item, ...fields }],
        errors: {},
      };
      await store.write("offline.u", damaged);
      await expect(library.sync()).rejects.toMatchObject({ code: "localData" });
      await expect(library.enqueue(item, quiz)).rejects.toMatchObject({
        code: "localData",
      });
      expect(post).not.toHaveBeenCalled();
      expect(await store.read("offline.u", null)).toEqual(damaged);
    },
  );
  it("uses strict persisted reads rather than discarding a corrupted offline record", async () => {
    const { store, api } = setup();
    const readStrict = vi.fn().mockRejectedValue(new Error("Damaged JSON"));
    const strictStore = { ...store, readStrict };
    const write = vi.spyOn(strictStore, "write");
    const library = new OfflineLibrary("u", strictStore, api);
    await expect(library.enqueue(item, quiz)).rejects.toThrow("Damaged JSON");
    expect(write).not.toHaveBeenCalled();
  });
  it("does not submit discarded answers after an in-flight sync completes", async () => {
    let finish!: (record: unknown) => void;
    let started!: () => void;
    const sent = new Promise<void>((resolve) => {
      started = resolve;
    });
    const post = vi.fn().mockImplementation(() => {
      started();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { library } = setup(post);
    await library.enqueue(item, quiz);
    const discarded = nextAttempt(quiz, "discarded");
    await library.enqueue(discarded.item, discarded.quiz);
    const syncing = library.sync();
    await sent;
    await library.discard(quiz.id);
    finish({ ...record, id: "server" });
    await syncing;
    expect(post).toHaveBeenCalledTimes(1);
    expect((await library.read()).queue).toHaveLength(0);
    expect((await library.read()).quizzes).toEqual({});
  });
  it("does not restore a discarded quiz’s error after an in-flight rejection", async () => {
    let reject!: (error: Error) => void;
    let started!: () => void;
    const sent = new Promise<void>((resolve) => {
      started = resolve;
    });
    const post = vi.fn().mockImplementation(() => {
      started();
      return new Promise((_, fail) => {
        reject = fail;
      });
    });
    const { library } = setup(post);
    await library.enqueue(item, quiz);
    const syncing = library.sync();
    await sent;
    await library.discard(quiz.id);
    reject(new ApiError(409, "Session changed"));
    await syncing;
    expect((await library.read()).errors).toEqual({});
  });
});
