import type { Question } from "@testownik/core/quiz/types";
import {
  checkAnswerCorrectness,
  getQuestionWithShuffledAnswers,
  getRemainingAttempts,
} from "@testownik/core/quiz/session";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { expect, it } from "vitest";

import { chatText } from "../src/lib/stream";

const q: Question = {
  id: "q",
  order: 1,
  text: "?",
  multiple: true,
  answers: [
    { id: "a", order: 1, text: "A", is_correct: true },
    { id: "b", order: 2, text: "B", is_correct: true },
    { id: "c", order: 3, text: "C", is_correct: false },
  ],
};
it("requires exactly the correct multi-select answers", () => {
  expect(checkAnswerCorrectness(q, ["a", "b"])).toBe(true);
  expect(checkAnswerCorrectness(q, ["a"])).toBe(false);
  expect(checkAnswerCorrectness(q, ["a", "b", "c"])).toBe(false);
});
it("keeps question repetition behavior shared with web", () => {
  expect(
    getRemainingAttempts(
      "q",
      [
        {
          id: "r",
          question: "q",
          answered_at: "2026-01-01",
          selected_answers: [],
          was_correct: false,
        },
      ],
      DEFAULT_USER_SETTINGS,
    ),
  ).toBe(2);
  expect(getQuestionWithShuffledAnswers(q, [], "session")).toEqual(
    getQuestionWithShuffledAnswers(q, [], "session"),
  );
});
it("parses split chat events without displaying protocol content", () => {
  expect(
    chatText(
      'data: {"type":"text-delta","delta":"Hello"}\n\ndata: {"type":"text-delta","delta":"',
    ),
  ).toBe("Hello");
  expect(() =>
    chatText('data: {"type":"error","errorText":"Quota"}\n'),
  ).toThrow("Quota");
});
