import { describe, expect, it } from "vitest";

import {
  describePaste,
  insertPastedAnswers,
  joinPastedAnswers,
  splitPastedAnswers,
} from "./paste-answers";
import { createAnswer, createQuestion } from "./quiz-editor-factories";

describe("Pasted answers", () => {
  it("keeps single lines and code or math blocks in one answer", () => {
    expect(splitPastedAnswers("jedna linia")).toBeNull();
    expect(splitPastedAnswers("```\nkod\n```")).toBeNull();
    expect(splitPastedAnswers("$$\nx\n$$")).toBeNull();
  });

  it("removes list markers only when every line has one", () => {
    expect(splitPastedAnswers("a) Alfa\nB. Beta\n3) Gamma\n- Delta")).toEqual([
      "Alfa",
      "Beta",
      "Gamma",
      "Delta",
    ]);
    expect(splitPastedAnswers("a) Alfa\nBeta\n\n")).toEqual([
      "a) Alfa",
      "Beta",
    ]);
  });

  it("fills empty answers after the target and inserts the rest", () => {
    const question = createQuestion(1);
    const filled = { ...createAnswer(3), text: "Zostaje" };
    question.answers = [
      { ...question.answers[0], is_correct: true },
      question.answers[1],
      filled,
    ];
    const result = insertPastedAnswers(question, question.answers[0].id, [
      "Alfa",
      "Beta",
      "Gamma",
    ]);
    expect(result.answers.map((answer) => answer.text)).toEqual([
      "Alfa",
      "Beta",
      "Gamma",
      "Zostaje",
    ]);
    expect(result.answers.map((answer) => answer.order)).toEqual([1, 2, 3, 4]);
    expect(result.answers[0].is_correct).toBe(true);
    expect(result.answers[1].id).toBe(question.answers[1].id);
  });

  it("joins a split paste without undoing later edits", () => {
    const question = createQuestion(1);
    const [first, second] = question.answers;
    const third = { ...createAnswer(3), text: "Istniejąca" };
    const original = { ...question, answers: [first, second, third] };
    const pasted = insertPastedAnswers(original, first.id, [
      "Alfa",
      "Beta",
      "Gamma",
      "Delta",
    ]);
    const paste = describePaste(
      original.answers,
      pasted.answers,
      first.id,
      "Alfa\nBeta\nGamma\nDelta",
    );
    // Later edits: the third answer, one added line, and a correct mark.
    const edited = {
      ...pasted,
      answers: pasted.answers.map((answer) =>
        answer.text === "Istniejąca"
          ? { ...answer, text: "Zmieniona" }
          : answer.text === "Delta"
            ? { ...answer, text: "Delta poprawiona" }
            : answer.text === "Beta"
              ? { ...answer, is_correct: true }
              : answer,
      ),
    };

    const joined = joinPastedAnswers(edited, paste);

    expect(joined.answers.map((answer) => answer.text)).toEqual([
      "Alfa\nBeta\nGamma\nDelta",
      "",
      "Delta poprawiona",
      "Zmieniona",
    ]);
    expect(joined.answers[1].is_correct).toBe(true);
    expect(joined.answers.map((answer) => answer.order)).toEqual([1, 2, 3, 4]);
  });
});
