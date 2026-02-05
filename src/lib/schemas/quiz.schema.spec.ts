import { describe, expect, it } from "vitest";

import { validateQuizForm } from "./quiz.schema";

describe("validateQuizForm", () => {
  it("should return detailed error for missing title", () => {
    const result = validateQuizForm({
      title: "",
      description: "desc",
      questions: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Tytuł quizu jest wymagany");
    }
  });

  it("should return detailed error for missing question text", () => {
    const result = validateQuizForm({
      title: "Title",
      description: "desc",
      questions: [
        {
          id: "q1",
          order: 1,
          text: "", // Missing text
          explanation: "",
          multiple: false,
          answers: [{ id: "a1", order: 1, text: "a1", is_correct: true }],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // We expect this to be improved. Currently it might be generic or just "Pytanie musi zawierać tekst..."
      // The goal is to have "Pytanie 1: Pytanie musi zawierać tekst lub zdjęcie"
      expect(result.error).toContain("Pytanie 1");
    }
  });

  it("should return detailed error for missing answer text", () => {
    const result = validateQuizForm({
      title: "Title",
      description: "desc",
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question text",
          explanation: "",
          multiple: false,
          answers: [
            { id: "a1", order: 1, text: "", is_correct: true }, // Missing text
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Goal: "Pytanie 1, Odpowiedź 1: Odpowiedź musi zawierać tekst lub zdjęcie"
      expect(result.error).toContain("Pytanie 1");
      expect(result.error).toContain("Odpowiedź 1");
    }
  });
});
