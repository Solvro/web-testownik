import { describe, expect, it } from "vitest";

import type {
  AnswerRecord,
  Question,
  QuizWithUserProgress,
} from "@/types/quiz";
import { AccessLevel } from "@/types/quiz";

import { isCurrentSessionQuestion, removeQuestionFromQuizCache } from "./utils";

const makeQuestion = (id: string): Question => ({
  id,
  order: 1,
  text: id,
  multiple: false,
  answers: [],
});

const makeAnswer = (question: string): AnswerRecord => ({
  id: `${question}-answer`,
  question,
  answered_at: "2026-01-01T00:00:00.000Z",
  selected_answers: [`${question}-answer-1`],
  was_correct: true,
});

const makeQuiz = (currentQuestion: string | null): QuizWithUserProgress => ({
  id: "quiz-1",
  title: "Quiz",
  description: "",
  visibility: AccessLevel.PRIVATE,
  allow_anonymous: false,
  is_anonymous: false,
  version: 1,
  questions: [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")],
  current_session: {
    id: "session-1",
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: null,
    is_active: true,
    study_time: 1,
    current_question: currentQuestion,
    answers: [makeAnswer("q1"), makeAnswer("q2")],
  },
});

describe("quiz helper utils", () => {
  it("detects the current session question", () => {
    const quiz = makeQuiz("q1");

    expect(isCurrentSessionQuestion(quiz, "q1")).toBe(true);
    expect(isCurrentSessionQuestion(quiz, "q2")).toBe(false);
  });

  it("removes a deleted current question, its answers, and moves the session", () => {
    const updated = removeQuestionFromQuizCache({
      quiz: makeQuiz("q1"),
      deletedQuestionId: "q1",
      newCurrentQuestionId: "q3",
    });

    expect(updated.questions.map((question) => question.id)).toEqual([
      "q2",
      "q3",
    ]);
    expect(
      updated.current_session?.answers.map((answer) => answer.question),
    ).toEqual(["q2"]);
    expect(updated.current_session?.current_question).toBe("q3");
  });

  it("does not move the session when a non-current question is deleted", () => {
    const updated = removeQuestionFromQuizCache({
      quiz: makeQuiz("q1"),
      deletedQuestionId: "q2",
      newCurrentQuestionId: "q3",
    });

    expect(updated.questions.map((question) => question.id)).toEqual([
      "q1",
      "q3",
    ]);
    expect(
      updated.current_session?.answers.map((answer) => answer.question),
    ).toEqual(["q1"]);
    expect(updated.current_session?.current_question).toBe("q1");
  });
});
