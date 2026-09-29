import { expect, it } from "vitest";
import type { Question } from "@testownik/core/quiz/types";
import { findQuestions, indexQuestions } from "../src/lib/question-search";
it("finds Polish text without accents, across answers and explanations", () => {
  const questions = [
    {
      id: "q1",
      text: "Żółć i łódź",
      explanation: "Szczegółowe wyjaśnienie",
      answers: [{ id: "a", text: "Źródło energii", is_correct: true }],
    },
    { id: "q2", text: "Another", answers: [] },
  ] as unknown as Question[];
  const index = indexQuestions(questions);
  expect(findQuestions(index, "LODZ zrodlo").map((x) => x.question.id)).toEqual(
    ["q1"],
  );
  expect(findQuestions(index, "wyjasnienie").map((x) => x.number)).toEqual([1]);
  expect(findQuestions(index, "not present")).toEqual([]);
  expect(findQuestions(index, " ")).toBe(index);
  expect(questions[0].text).toBe("Żółć i łódź");
});
