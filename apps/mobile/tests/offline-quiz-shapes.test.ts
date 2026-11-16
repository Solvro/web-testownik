import { expect, it, vi } from "vitest";
import { OfflineLibrary } from "../src/lib/offline";
import type { ApiClient } from "../src/lib/client";

const answer = {
  id: "record",
  question: "question",
  answered_at: "2026-10-12",
  selected_answers: ["answer"],
  was_correct: true,
};
const bank = {
  id: "bank",
  title: "Retained quiz",
  questions: [
    {
      id: "question",
      text: "Question",
      multiple: false,
      answers: [{ id: "answer", text: "Answer", is_correct: true }],
    },
  ],
};
const pending = {
  request_id: "record",
  quiz_id: "bank",
  session_id: "session",
  version: 1,
  question_id: "question",
  selected_answers: ["answer"],
  elapsed_seconds: 5,
  next_question: null,
  local: answer,
};

it.each([
  ["null quiz", null],
  ["missing questions", { id: "bank", title: "Quiz" }],
  ["null question", { ...bank, questions: [null] }],
  [
    "null answer list",
    { ...bank, questions: [{ ...bank.questions[0], answers: null }] },
  ],
  [
    "non-text answer",
    {
      ...bank,
      questions: [
        {
          ...bank.questions[0],
          answers: [{ ...bank.questions[0].answers[0], text: {} }],
        },
      ],
    },
  ],
  [
    "non-boolean correctness",
    {
      ...bank,
      questions: [
        {
          ...bank.questions[0],
          answers: [{ ...bank.questions[0].answers[0], is_correct: "false" }],
        },
      ],
    },
  ],
  [
    "null session answers",
    { ...bank, current_session: { id: "session", answers: null } },
  ],
  [
    "null history row",
    { ...bank, current_session: { id: "session", answers: [null] } },
  ],
  [
    "non-array answer choices",
    {
      ...bank,
      current_session: {
        id: "session",
        answers: [{ ...answer, selected_answers: {} }],
      },
    },
  ],
])(
  "rejects %s while preserving the complete raw library and pending answers",
  async (_name, corrupt) => {
    const original = JSON.stringify({
      quizzes: { bank: corrupt },
      queue: [pending],
      errors: {},
    });
    let raw = original;
    const write = vi.fn(async (_key: string, value: unknown) => {
      raw = JSON.stringify(value);
    });
    const store = { read: async <T>() => JSON.parse(raw) as T, write };
    const library = new OfflineLibrary("shape-fixture", store, {} as ApiClient);
    const failure = await library.read().then(
      () => null,
      (error: unknown) => error,
    );
    expect(raw).toBe(original);
    expect(JSON.parse(raw).queue).toEqual([pending]);
    expect(write).not.toHaveBeenCalled();
    expect(failure).toMatchObject({ code: "localData" });
  },
);

it.each([
  bank,
  { ...bank, current_session: null },
  { ...bank, current_session: { id: "session", answers: [answer] } },
  {
    ...bank,
    current_session: {
      id: "session",
      answers: [],
      current_question: null,
      study_time: 0,
    },
  },
])(
  "accepts older valid bank/session structures without requiring new metadata",
  async (quiz) => {
    const state = { quizzes: { bank: quiz }, queue: [pending], errors: {} };
    const store = {
      read: async <T>() => structuredClone(state) as T,
      write: vi.fn(),
    };
    const library = new OfflineLibrary("shape-fixture", store, {} as ApiClient);
    expect(await library.read()).toEqual(state);
    expect(store.write).not.toHaveBeenCalled();
  },
);
