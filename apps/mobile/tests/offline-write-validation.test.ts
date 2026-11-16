import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { expect, it, vi } from "vitest";

import type { ApiClient } from "../src/lib/client";
import { OfflineLibrary, type PendingAnswer } from "../src/lib/offline";

const answer = {
  id: "local",
  question: "question",
  selected_answers: ["choice"],
  was_correct: true,
  answered_at: "2026-10-12T00:00:00Z",
};
const quiz = {
  id: "bank",
  title: "Saved quiz",
  version: 1,
  questions: [
    {
      id: "question",
      text: "Question",
      answers: [{ id: "choice", text: "Choice", is_correct: true }],
    },
  ],
  current_session: { id: "session", answers: [answer] },
} as unknown as QuizWithUserProgress;
const item: PendingAnswer = {
  request_id: "request",
  quiz_id: "bank",
  session_id: "session",
  version: 1,
  question_id: "question",
  selected_answers: ["choice"],
  elapsed_seconds: 5,
  next_question: null,
  local: answer,
};

function setup(ack?: unknown, queue: PendingAnswer[] = [item]) {
  const original = JSON.stringify({
    quizzes: { bank: quiz },
    queue,
    errors: {},
  });
  let raw = original;
  const write = vi.fn(async (_key: string, value: unknown) => {
    raw = JSON.stringify(value);
  });
  const store = { read: async <T>() => JSON.parse(raw) as T, write };
  const post = vi.fn().mockResolvedValue(ack);
  return {
    original,
    raw: () => raw,
    write,
    post,
    library: new OfflineLibrary("write-fixture", store, {
      post,
    } as unknown as ApiClient),
  };
}

it.each([
  { ...quiz, questions: null },
  { ...quiz, id: "new", current_session: { id: "session", answers: [null] } },
])(
  "rejects malformed API cache writes without touching existing quizzes or queued answers",
  async (value) => {
    const { library, raw, original, write } = setup();
    // A different quiz bypasses the intentional pending-answer cache protection.
    const malformed = {
      ...value,
      id: "new",
    } as unknown as QuizWithUserProgress;
    await expect(library.cache(malformed)).rejects.toMatchObject({
      code: "localData",
    });
    expect(write).not.toHaveBeenCalled();
    expect(raw()).toBe(original);
    expect((await library.read()).queue).toEqual([item]);
  },
);

it.each([undefined, null, -1, 1.5, "1"])(
  "rejects unavailable quiz version %s before enqueue with refresh guidance",
  async (version) => {
    const { library, raw, original, write } = setup();
    await expect(
      library.enqueue(
        { ...item, request_id: "new", version } as PendingAnswer,
        quiz,
      ),
    ).rejects.toMatchObject({ code: "quizRefresh" });
    expect(write).not.toHaveBeenCalled();
    expect(raw()).toBe(original);
    expect((await library.read()).queue).toEqual([item]);
  },
);

it("rejects invalid local answer updates before they overwrite the saved quiz", async () => {
  const { library, raw, original, write } = setup();
  const invalid = {
    ...quiz,
    current_session: { id: "session", answers: [null] },
  };
  await expect(
    library.enqueue(
      { ...item, request_id: "new" },
      invalid as unknown as QuizWithUserProgress,
    ),
  ).rejects.toMatchObject({ code: "localData" });
  expect(write).not.toHaveBeenCalled();
  expect(raw()).toBe(original);
});

it.each([undefined, null, {}, { ...answer, question: "another-question" }])(
  "retains the local answer when a successful acknowledgement has unusable content",
  async (ack) => {
    const { library, post } = setup(ack);
    await library.sync();
    const state = await library.read();
    expect(state.queue).toEqual([]);
    expect(state.quizzes.bank.current_session?.answers).toEqual([answer]);
    await library.sync();
    expect(post).toHaveBeenCalledTimes(1);
  },
);

it.each([undefined, null, 0])(
  "retains readable legacy study time %s through JSON persistence",
  async (study_time) => {
    const { library } = setup();
    const legacy = {
      ...quiz,
      id: "legacy",
      current_session: { id: "session", answers: [], study_time },
    } as unknown as QuizWithUserProgress;
    await library.cache(legacy);
    expect(
      (await library.read()).quizzes.legacy.current_session?.answers,
    ).toEqual([]);
  },
);

it("keeps other pending requests after an unusable successful acknowledgement", async () => {
  const { library, post } = setup();
  const second = {
    ...item,
    request_id: "second",
    local: { ...answer, id: "second" },
  };
  await library.enqueue(second, {
    ...quiz,
    current_session: {
      ...quiz.current_session!,
      answers: [answer, second.local],
    },
  });
  post
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new TypeError("network"));
  await expect(library.sync()).rejects.toThrow("network");
  const state = await library.read();
  expect(state.queue).toEqual([second]);
  expect(state.quizzes.bank.current_session?.answers).toEqual([
    answer,
    second.local,
  ]);
});

it("refuses unconfirmed removal without changing a saved quiz or its pending answers", async () => {
  const { library, raw, original, write } = setup();
  await expect(library.remove(quiz.id)).rejects.toMatchObject({
    code: "pendingAnswers",
  });
  expect(raw()).toBe(original);
  expect(write).not.toHaveBeenCalled();
});

it("protects an answer enqueued immediately before an unconfirmed removal transaction", async () => {
  const { library } = setup(undefined, []);
  await library.cache({
    ...quiz,
    current_session: { ...quiz.current_session!, answers: [] },
  });
  const outcomes = await Promise.allSettled([
    library.enqueue(item, quiz),
    library.remove(quiz.id),
  ]);
  expect(outcomes[0].status).toBe("fulfilled");
  expect(outcomes[1]).toMatchObject({
    status: "rejected",
    reason: { code: "pendingAnswers" },
  });
  const saved = await library.read();
  expect(saved.queue).toEqual([item]);
  expect(saved.quizzes[quiz.id]).toEqual(quiz);
});
