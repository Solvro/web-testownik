import { expect, it } from "vitest";
import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { studySummary } from "../src/lib/study-summary";
const quiz = { id: "quiz", version: 3 };
function cached(): QuizWithUserProgress {
  return {
    ...quiz,
    questions: [{ id: "one" }, { id: "two" }],
    user_settings: {
      initial_reoccurrences: 2,
      wrong_answer_reoccurrences: 1,
      max_question_reoccurrences: null,
    },
    current_session: {
      is_active: true,
      ended_at: null,
      answers: [
        {
          question: "one",
          was_correct: true,
          answered_at: "2026-09-26T10:00:00Z",
        },
        {
          question: "one",
          was_correct: true,
          answered_at: "2026-09-26T10:00:01Z",
        },
        {
          question: "two",
          was_correct: true,
          answered_at: "2026-09-26T10:00:02Z",
        },
      ],
    },
  } as QuizWithUserProgress;
}
it("uses repeat-based mastery, not raw answer count, in both languages", () => {
  expect(studySummary(quiz, cached(), "en")).toBe("1 of 2 questions mastered");
  expect(studySummary(quiz, cached(), "pl")).toBe("Opanowane pytania: 1 z 2");
});
it("never attaches an incompatible cached session to a recent quiz", () => {
  expect(studySummary(quiz, undefined, "en")).toBeNull();
  expect(studySummary({ ...quiz, id: "other" }, cached(), "en")).toBeNull();
  expect(studySummary({ ...quiz, version: 4 }, cached(), "en")).toBeNull();
});
it("does not claim progress for an empty, ended, or unstarted session", () => {
  const value = cached();
  value.current_session!.ended_at = "2026-09-26T11:00:00Z";
  expect(studySummary(quiz, value, "en")).toBeNull();
  value.current_session!.ended_at = null;
  value.current_session!.is_active = false;
  expect(studySummary(quiz, value, "en")).toBeNull();
  value.current_session!.is_active = true;
  value.current_session!.answers = [];
  expect(studySummary(quiz, value, "en")).toBeNull();
  value.questions = [];
  expect(studySummary(quiz, value, "en")).toBeNull();
});
