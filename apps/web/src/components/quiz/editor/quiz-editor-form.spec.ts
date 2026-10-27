import type { QuestionFormData } from "@testownik/core/quiz/schema";
import { describe, expect, it } from "vitest";

import { createAnswer, createQuestion } from "./quiz-editor-factories";
import {
  questionIssue,
  rememberQuestionTypes,
  restoreQuestionTypes,
  withQuestionType,
} from "./quiz-editor-form";

function choice(
  type: "single_choice" | "multiple_choice",
  correct: number[],
): QuestionFormData {
  return {
    ...createQuestion(1, type),
    text: "Pytanie",
    answers: ["a", "b", "c"].map((text, index) => ({
      ...createAnswer(index + 1, text),
      is_correct: correct.includes(index),
    })),
  };
}

describe("withQuestionType", () => {
  it("keeps the answers between the choice types", () => {
    const question = choice("multiple_choice", [0, 2]);
    const single = withQuestionType(question, "single_choice");
    expect(single.answers).toEqual(question.answers);
    expect(questionIssue(single)).toBe("conflict");
  });

  it("turns a question into true/false with the default labels", () => {
    const question = choice("single_choice", [1]);
    const trueFalse = withQuestionType(
      { ...question, answers: [] },
      "true_false",
    );
    expect(trueFalse.shuffle_answers).toBe(false);
    expect(trueFalse.answers.map((answer) => answer.text)).toEqual([
      "Prawda",
      "Fałsz",
    ]);
    expect(trueFalse.answers.map((answer) => answer.is_correct)).toEqual([
      true,
      false,
    ]);
  });

  it("keeps two written answers as the true/false labels", () => {
    const question = choice("single_choice", [1]);
    const trueFalse = withQuestionType(question, "true_false");
    expect(trueFalse.answers.map((answer) => answer.text)).toEqual(["a", "b"]);
    expect(trueFalse.answers.map((answer) => answer.is_correct)).toEqual([
      false,
      true,
    ]);
  });

  it("drops the default labels when leaving true/false", () => {
    const trueFalse = createQuestion(1, "true_false");
    const open = withQuestionType(trueFalse, "open");
    expect(open.answers).toHaveLength(1);
    expect(open.answers[0].text).toBe("");
    expect(open.answers[0].is_correct).toBe(true);

    const single = withQuestionType(trueFalse, "single_choice");
    expect(single.answers.map((answer) => answer.text)).toEqual(["", ""]);
    expect(single.shuffle_answers).toBe(false);
  });

  it("keeps edited true/false labels as answers of the new type", () => {
    const trueFalse = createQuestion(1, "true_false");
    trueFalse.answers[0].text = "Tak";
    const single = withQuestionType(trueFalse, "single_choice");
    expect(single.answers.map((answer) => answer.text)).toEqual(["Tak", ""]);
  });

  it("accepts every answer of an open question and drops images", () => {
    const question = choice("multiple_choice", [0]);
    question.answers[1].image_url = "https://example.com/a.png";
    const open = withQuestionType(question, "open");
    expect(open.answers.every((answer) => answer.is_correct)).toBe(true);
    expect(open.answers[1].image_url).toBeNull();
    expect(questionIssue(open)).toBeNull();
  });
});

describe("restoreQuestionTypes", () => {
  it("puts back the type and the rewritten answers, keeping other edits", () => {
    const question = choice("multiple_choice", [0, 2]);
    const previous = rememberQuestionTypes([question]);
    const changed = withQuestionType(question, "true_false");
    const edited = { ...changed, text: "Nowa treść" };
    const [restored] = restoreQuestionTypes([edited], previous);
    expect(restored.type).toBe("multiple_choice");
    expect(restored.text).toBe("Nowa treść");
    expect(restored.answers).toEqual(question.answers);
  });

  it("puts back the labels dropped when leaving true/false", () => {
    const trueFalse = { ...createQuestion(1, "true_false"), text: "Pytanie" };
    const previous = rememberQuestionTypes([trueFalse]);
    const single = withQuestionType(trueFalse, "single_choice");
    expect(single.answers.map((answer) => answer.text)).toEqual(["", ""]);
    const [restored] = restoreQuestionTypes([single], previous);
    expect(restored.type).toBe("true_false");
    expect(restored.shuffle_answers).toBe(false);
    expect(restored.answers.map((answer) => answer.text)).toEqual([
      "Prawda",
      "Fałsz",
    ]);
  });

  it("keeps edits made after leaving true/false with custom labels", () => {
    const trueFalse = { ...createQuestion(1, "true_false"), text: "Pytanie" };
    trueFalse.answers[0].text = "Tak";
    trueFalse.answers[1].text = "Nie";
    const previous = rememberQuestionTypes([trueFalse]);
    const single = withQuestionType(trueFalse, "single_choice");
    const edited = {
      ...single,
      answers: single.answers.map((answer, index) =>
        index === 0 ? { ...answer, text: "Zdecydowanie tak" } : answer,
      ),
    };
    const [restored] = restoreQuestionTypes([edited], previous);
    expect(restored.type).toBe("true_false");
    expect(restored.answers.map((answer) => answer.text)).toEqual([
      "Zdecydowanie tak",
      "Nie",
    ]);
  });

  it("keeps the answers edited after a change between choice types", () => {
    const question = choice("multiple_choice", [0, 2]);
    const previous = rememberQuestionTypes([question]);
    const changed = withQuestionType(question, "single_choice");
    const edited = {
      ...changed,
      answers: changed.answers.map((answer) => ({ ...answer, text: "x" })),
    };
    const [restored] = restoreQuestionTypes([edited], previous);
    expect(restored.type).toBe("multiple_choice");
    expect(restored.answers.every((answer) => answer.text === "x")).toBe(true);
  });
});

describe("questionIssue", () => {
  it("needs exactly one correct answer for single choice and true/false", () => {
    expect(questionIssue(choice("single_choice", []))).toBe("missing-correct");
    expect(questionIssue(choice("single_choice", [0, 1]))).toBe("conflict");
    expect(questionIssue(choice("single_choice", [1]))).toBeNull();
    const trueFalse = createQuestion(1, "true_false");
    trueFalse.text = "Pytanie";
    expect(questionIssue(trueFalse)).toBeNull();
    expect(
      questionIssue({
        ...trueFalse,
        answers: trueFalse.answers.map((answer) => ({
          ...answer,
          is_correct: true,
        })),
      }),
    ).toBe("conflict");
  });

  it("only reminds about multiple choice without a correct answer", () => {
    expect(questionIssue(choice("multiple_choice", []))).toBe("no-correct");
  });

  it("needs text in every accepted answer of an open question", () => {
    const open = withQuestionType(choice("single_choice", [0]), "open");
    expect(questionIssue(open)).toBeNull();
    expect(
      questionIssue({
        ...open,
        answers: [{ ...open.answers[0], text: " " }],
      }),
    ).toBe("missing");
  });
});
