import { expect, it } from "vitest";
import { questionIssue } from "../src/lib/editor-store";
import { editorValidation } from "../src/lib/editor-validation";
const english = (_: string, en: string) => en;
const question = {
  id: "q",
  order: 1,
  text: "Question",
  multiple: false,
  answers: [{ id: "a", order: 1, text: "Answer", is_correct: true }],
};
it("identifies the exact invalid answer in the requested language", () => {
  const draft = {
    title: "Quiz",
    description: "",
    questions: [
      question,
      { ...question, answers: [{ ...question.answers[0], text: "" }] },
    ],
  };
  expect(editorValidation(draft, english)).toEqual({
    question: 1,
    message: "Question 2, answer 1: Add answer text or an image.",
  });
  expect(editorValidation(draft, (pl) => pl)?.message).toContain(
    "Pytanie 2, odpowiedź 1:",
  );
});
it("accepts image-only content but requires a correct answer", () => {
  const imageOnly = {
    ...question,
    text: "",
    image: "https://example.com/q.png",
    answers: [{ ...question.answers[0], text: "", image_upload: "upload" }],
  };
  const draft = { title: "Quiz", description: "", questions: [imageOnly] };
  expect(editorValidation(draft, english)).toBeNull();
  imageOnly.answers[0].is_correct = false;
  expect(editorValidation(draft, english)).toEqual({
    question: 0,
    message: "Question 1: mark at least one correct answer.",
  });
});
it("holds answer problems back until the author works on the answers", () => {
  const typed = {
    ...question,
    answers: [
      { ...question.answers[0], text: "", is_correct: false },
      { ...question.answers[0], id: "b", order: 2, text: "" },
    ],
  };
  expect(questionIssue(typed, english, { answers: false })).toBeNull();
  expect(
    questionIssue({ ...typed, text: "" }, english, { answers: false }),
  ).toBe("Question text missing");
  expect(questionIssue(typed, english)).toBe("Answer 1 is empty");
});
it("names the empty answer", () => {
  const draft = {
    ...question,
    answers: [
      question.answers[0],
      { ...question.answers[0], id: "b", text: " " },
    ],
  };
  expect(questionIssue(draft, english)).toBe("Answer 2 is empty");
  expect(questionIssue(draft, (pl) => pl)).toBe("Odpowiedź 2 jest pusta");
});
