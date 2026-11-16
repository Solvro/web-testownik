import { expect, it } from "vitest";
import {
  AccessLevel,
  type QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import {
  storedValueBytes,
  MAX_CHUNK_VALUE_BYTES,
} from "../src/lib/android-chunk-storage";
import {
  explainQuizStorageFailure,
  quizStorageIssue,
  quizStorageMessage,
  formatQuizStorageSize,
} from "../src/lib/quiz-storage-issue";
import { UserFacingError } from "../src/lib/user-error";
import type { OfflineState } from "../src/lib/offline";
const quiz = (id: string, text: string): QuizWithUserProgress => ({
  id,
  title: id,
  description: text,
  visibility: AccessLevel.PRIVATE,
  allow_anonymous: false,
  is_anonymous: false,
  version: 1,
  questions: [],
});

it("measures actual serialized Unicode bytes with the chunk accounting", () => {
  for (const value of [
    "",
    "Zażółć 漢 🦊",
    "bad\uD800\u0000",
    { text: "🌱".repeat(200) },
  ])
    expect(storedValueBytes(value)).toBe(
      Buffer.byteLength(JSON.stringify(value)),
    );
});
it("distinguishes an oversized quiz from a shared account limit, including its own queue and errors", () => {
  const state: OfflineState = {
    quizzes: {
      a: quiz("a", "small"),
      b: quiz("b", "x".repeat(MAX_CHUNK_VALUE_BYTES)),
    },
    queue: [],
    errors: { a: "retained conflict" },
  };
  const error = new UserFacingError("storageValueTooLarge");
  const before = JSON.stringify(state);
  expect(
    quizStorageIssue(explainQuizStorageFailure(error, state, "a")),
  ).toEqual({ code: "storageValueTooLarge", fitsAlone: true });
  expect(
    quizStorageIssue(explainQuizStorageFailure(error, state, "b")),
  ).toEqual({ code: "storageValueTooLarge", fitsAlone: false });
  expect(JSON.stringify(state)).toBe(before);
  state.quizzes.a = quiz("a", "x".repeat(MAX_CHUNK_VALUE_BYTES - 1000));
  state.errors.a = "retained conflict".repeat(100);
  expect(
    quizStorageIssue(explainQuizStorageFailure(error, state, "a"))?.fitsAlone,
  ).toBe(false);
});
it("counts only this quiz's queued requests when checking whether it fits alone", () => {
  const selected = ["x".repeat(MAX_CHUNK_VALUE_BYTES)];
  const pending: OfflineState["queue"][number] = {
    request_id: "pending",
    quiz_id: "b",
    session_id: "session",
    version: 1,
    question_id: "q",
    selected_answers: selected,
    elapsed_seconds: 0,
    next_question: null,
    local: {
      id: "pending",
      question: "q",
      selected_answers: selected,
      was_correct: false,
      answered_at: "2026-10-11T20:00:00Z",
    },
  };
  const state: OfflineState = {
    quizzes: { a: quiz("a", "small"), b: quiz("b", "small") },
    queue: [pending],
    errors: {},
  };
  const error = new UserFacingError("storageValueTooLarge");
  expect(
    quizStorageIssue(explainQuizStorageFailure(error, state, "a"))?.fitsAlone,
  ).toBe(true);
  expect(
    quizStorageIssue(explainQuizStorageFailure(error, state, "b"))?.fitsAlone,
  ).toBe(false);
  expect(state.queue[0]).toBe(pending);
});
it("preserves unknown failures and distinguishes physical/database quota from the 8 MB value limit", () => {
  const unknown = new Error("permission denied");
  const state: OfflineState = { quizzes: {}, queue: [], errors: {} };
  expect(explainQuizStorageFailure(unknown, state, "a")).toBe(unknown);
  const full = quizStorageIssue(
    explainQuizStorageFailure(new UserFacingError("storageFull"), state, "a"),
  )!;
  expect(full).toEqual({ code: "storageFull", fitsAlone: null });
  expect(quizStorageMessage(full, (_, en) => en)).not.toContain("8 MB");
  expect(
    quizStorageIssue(new DOMException("Browser quota", "QuotaExceededError"))
      ?.code,
  ).toBe("storageFull");
});
it("gives localized specific recovery and size labels", () => {
  for (const language of ["en", "pl"] as const) {
    const t = (pl: string, en: string) => (language === "pl" ? pl : en);
    const shared = quizStorageMessage(
      { code: "storageValueTooLarge", fitsAlone: true },
      t,
    );
    const alone = quizStorageMessage(
      { code: "storageValueTooLarge", fitsAlone: false, stale: true },
      t,
    );
    expect(shared).toContain(
      language === "pl" ? "wspólny limit 8 MB" : "shared 8 MB limit",
    );
    expect(alone).toContain(
      language === "pl" ? "nawet bez innych" : "even without other",
    );
    expect(alone).toContain(
      language === "pl" ? "Wersja quizu" : "quiz version",
    );
    expect(formatQuizStorageSize(1.5 * 1024 * 1024, language)).toBe(
      language === "pl" ? "1,5 MB" : "1.5 MB",
    );
  }
});
