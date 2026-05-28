import { describe, expect, it } from "vitest";

import {
  getQuestionWithShuffledAnswers,
  resolveCurrentQuestion,
} from "@/lib/session-utils";
import type {
  AnswerRecord,
  Question,
  QuizWithUserProgress,
} from "@/types/quiz";
import { AccessLevel } from "@/types/quiz";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

const makeQuestion = (id: string): Question => ({
  id,
  order: 1,
  text: id,
  multiple: false,
  answers: ["a", "b", "c", "d"].map((suffix, index) => ({
    id: `${id}-${suffix}`,
    order: index + 1,
    text: suffix,
    is_correct: index === 0,
  })),
});

const makeAnswer = (
  question: string,
  answeredAt = "2026-01-01T00:00:00.000Z",
): AnswerRecord => ({
  id: `${question}-answer`,
  question,
  answered_at: answeredAt,
  selected_answers: [],
  was_correct: false,
});

describe("session-utils answer shuffling", () => {
  it("uses question id in the answer shuffle seed", () => {
    const first = getQuestionWithShuffledAnswers(
      makeQuestion("q1"),
      [],
      "session-1",
    );
    const second = getQuestionWithShuffledAnswers(
      makeQuestion("q2"),
      [],
      "session-1",
    );

    expect(first.answers.map((answer) => answer.id)).toEqual([
      "q1-a",
      "q1-d",
      "q1-b",
      "q1-c",
    ]);
    expect(second.answers.map((answer) => answer.id)).toEqual([
      "q2-d",
      "q2-c",
      "q2-a",
      "q2-b",
    ]);
  });

  it("changes answer order for a later appearance of the same question", () => {
    const question = makeQuestion("q1");
    const firstAppearance = getQuestionWithShuffledAnswers(
      question,
      [],
      "session-1",
    );
    const secondAppearance = getQuestionWithShuffledAnswers(
      question,
      [makeAnswer("q1")],
      "session-1",
    );

    expect(firstAppearance.answers.map((answer) => answer.id)).toEqual([
      "q1-a",
      "q1-d",
      "q1-b",
      "q1-c",
    ]);
    expect(secondAppearance.answers.map((answer) => answer.id)).toEqual([
      "q1-b",
      "q1-d",
      "q1-c",
      "q1-a",
    ]);
  });

  it("keeps answer order stable after checking the current question", () => {
    const quiz: QuizWithUserProgress = {
      id: "quiz-1",
      title: "Quiz",
      description: "",
      visibility: AccessLevel.PRIVATE,
      allow_anonymous: false,
      is_anonymous: false,
      version: 1,
      questions: [makeQuestion("q1")],
      user_settings: DEFAULT_USER_SETTINGS,
      current_session: {
        id: "session-1",
        started_at: "2026-01-01T00:00:00.000Z",
        ended_at: null,
        is_active: true,
        study_time: 1,
        current_question: "q1",
        answers: [],
      },
    };

    const beforeCheck = resolveCurrentQuestion(quiz, DEFAULT_USER_SETTINGS);
    const afterCheck = resolveCurrentQuestion(
      {
        ...quiz,
        current_session:
          quiz.current_session == null
            ? null
            : {
                ...quiz.current_session,
                answers: [makeAnswer("q1")],
              },
      },
      DEFAULT_USER_SETTINGS,
      true,
    );

    expect(afterCheck?.answers.map((answer) => answer.id)).toEqual(
      beforeCheck?.answers.map((answer) => answer.id),
    );
  });
});
