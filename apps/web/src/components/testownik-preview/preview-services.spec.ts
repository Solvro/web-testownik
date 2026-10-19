import type { Question } from "@testownik/core/quiz/types";
import { describe, expect, it, vi } from "vitest";

import { PREVIEW_QUESTIONS, PREVIEW_QUIZ_ID } from "./preview-fixtures";
import { createPreviewServices } from "./preview-services";
import type { PreviewQuizEditor } from "./preview-services";

function createEditor(): PreviewQuizEditor & { current: Question[] } {
  const editor = {
    current: PREVIEW_QUESTIONS,
    questions: () => editor.current,
    add: vi.fn((added: Question[]) => {
      editor.current = [...editor.current, ...added];
    }),
    update: vi.fn((updated: Question) => {
      editor.current = editor.current.map((question) =>
        question.id === updated.id ? updated : question,
      );
    }),
  };
  return editor;
}

const generated = (text: string) => ({
  text,
  explanation: "Bo tak.",
  multiple: false,
  is_ai_generated: true,
  answers: [
    { text: "tak", is_correct: true },
    { text: "nie", is_correct: false },
  ],
});

describe("preview quiz service", () => {
  it("saves created questions into the session's quiz", async () => {
    const editor = createEditor();
    const { quiz } = createPreviewServices(vi.fn(), editor);

    const created = await quiz.createQuestion(
      PREVIEW_QUIZ_ID,
      generated("Pierwsze?"),
    );
    expect(created.order).toBe(105);
    expect(created.is_ai_generated).toBe(true);
    expect(created.answers.map(({ order, text }) => [order, text])).toEqual([
      [1, "tak"],
      [2, "nie"],
    ]);
    expect(editor.add).toHaveBeenCalledWith([created]);

    const bulk = await quiz.bulkCreateQuestions(PREVIEW_QUIZ_ID, [
      generated("Drugie?"),
      generated("Trzecie?"),
    ]);
    expect(bulk.map(({ order }) => order)).toEqual([106, 107]);
    expect(new Set([created.id, ...bulk.map(({ id }) => id)]).size).toBe(3);
    const { questions } = await quiz.getQuiz(PREVIEW_QUIZ_ID);
    expect(questions).toHaveLength(PREVIEW_QUESTIONS.length + 3);
  });

  it("returns questions already in the quiz instead of duplicating them", async () => {
    const editor = createEditor();
    const { quiz } = createPreviewServices(vi.fn(), editor);

    const [first] = await quiz.bulkCreateQuestions(PREVIEW_QUIZ_ID, [
      generated("Pierwsze?"),
    ]);
    const again = await quiz.bulkCreateQuestions(PREVIEW_QUIZ_ID, [
      generated("Pierwsze?"),
      generated("Pierwsze?"),
    ]);
    expect(again).toEqual([first, first]);
    expect(editor.add).toHaveBeenCalledTimes(1);
  });

  it("applies question edits, keeping ids", async () => {
    const editor = createEditor();
    const { quiz } = createPreviewServices(vi.fn(), editor);
    const [original] = PREVIEW_QUESTIONS;

    const updated = await quiz.updateQuestion(original.id, {
      text: "Nowa treść",
      answers: [
        ...original.answers.slice(0, 2).map((answer) => ({
          ...answer,
          text: `${answer.text}!`,
        })),
        { id: "", order: 3, text: "nowa", is_correct: true },
      ],
    });
    expect(updated.id).toBe(original.id);
    expect(updated.order).toBe(original.order);
    expect(updated.text).toBe("Nowa treść");
    expect(updated.answers.slice(0, 2).map(({ id }) => id)).toEqual(
      original.answers.slice(0, 2).map(({ id }) => id),
    );
    expect(updated.answers[2].id).not.toBe("");
    expect(updated.multiple).toBe(true);
    expect(editor.update).toHaveBeenCalledWith(updated);

    await expect(quiz.updateQuestion("nope", { text: "x" })).rejects.toThrow(
      /not available/,
    );
  });

  it("keeps its own questions without a session", async () => {
    const { quiz } = createPreviewServices(vi.fn());
    await quiz.createQuestion(PREVIEW_QUIZ_ID, generated("Samodzielne?"));
    const { questions } = await quiz.getQuiz(PREVIEW_QUIZ_ID);
    expect(questions.at(-1)?.text).toBe("Samodzielne?");
  });
});
