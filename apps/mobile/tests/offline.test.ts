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
      library.enqueue({ ...item, request_id: "second" }, quiz),
    ]);
    expect((await library.read()).queue).toHaveLength(2);
  });
  it("retains conflicts and blocks later answers from the same quiz", async () => {
    const post = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "Session changed"));
    const { library } = setup(post);
    await library.enqueue(item, quiz);
    await library.enqueue({ ...item, request_id: "second" }, quiz);
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
  it("isolates caches for different accounts", async () => {
    const { library, store, api } = setup();
    await library.enqueue(item, quiz);
    expect(
      (await new OfflineLibrary("other", store, api).read()).queue,
    ).toHaveLength(0);
  });
});
