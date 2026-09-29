import { expect, it } from "vitest";
import {
  correctPracticeAnswer,
  practiceQuestions,
} from "../src/lib/chat-tools";
const question = {
  text: "Select prime numbers",
  answers: [
    { text: "2", is_correct: true },
    { text: "3", is_correct: true },
    { text: "4", is_correct: false },
  ],
  explanation: "Two and three are prime.",
};
it("validates the existing server JSON-string output and object output", () => {
  expect(practiceQuestions(JSON.stringify({ questions: [question] }))).toEqual([
    question,
  ]);
  expect(practiceQuestions(question, true)).toEqual([question]);
  for (const output of [
    "oops",
    null,
    { questions: [] },
    {
      questions: [
        { ...question, answers: [{ text: "empty", is_correct: false }] },
      ],
    },
    {
      questions: [
        {
          ...question,
          answers: [
            { text: "2", is_correct: "false" },
            { text: "3", is_correct: true },
          ],
        },
      ],
    },
  ])
    expect(practiceQuestions(output)).toBeNull();
});
it("requires exactly all correct selections, not merely one match", () => {
  expect(correctPracticeAnswer(question, [0, 1])).toBe(true);
  expect(correctPracticeAnswer(question, [1, 0])).toBe(true);
  expect(correctPracticeAnswer(question, [0])).toBe(false);
  expect(correctPracticeAnswer(question, [0, 1, 2])).toBe(false);
  expect(correctPracticeAnswer(question, [])).toBe(false);
});
