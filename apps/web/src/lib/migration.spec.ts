import { describe, expect, it } from "vitest";

import { migrateLegacyQuiz } from "@/lib/migration";
import type { LegacyQuiz } from "@/types/quiz-legacy";

// eslint-disable-next-line @typescript-eslint/no-deprecated
const mockLegacyGuestQuiz: LegacyQuiz = {
  id: "ae36c397-8ccc-41be-b341-1ce9712f05eb",
  title: "JP-2023-1",
  description: "",
  questions: [
    {
      id: 1,
      question:
        'Jaki będzie wynik próby skompilowania i uruchomienia poniższego fragmentu kodu?\n\n```java\nint a = 220;\nint b = 202;\nint sum = a + b;\nSystem.out.println("Sum = " + sum);\n```',
      multiple: true,
      answers: [
        { answer: "Na ekranie pojawi się: Sum = 422", correct: true },
        { answer: "Na ekranie pojawi się: Sum = 644", correct: false },
        {
          answer: "Kompilacja tego fragmentu zakończy się błędem",
          correct: false,
        },
      ],
    },
    {
      id: 2,
      question: "Które z poniższych nie jest słowem kluczowym języka Java?",
      multiple: true,
      answers: [
        { answer: "default", correct: false },
        { answer: "implement", correct: true },
        { answer: "volatile", correct: false },
      ],
    },
    {
      id: 3,
      question: "Pytanie trzecie?",
      multiple: false,
      answers: [
        { answer: "Odpowiedź A", correct: false },
        { answer: "Odpowiedź B", correct: true },
      ],
    },
  ],
};

describe("Migration", () => {
  describe("migrateLegacyQuiz", () => {
    it("should convert legacy quiz to new format", () => {
      const { quiz } = migrateLegacyQuiz(mockLegacyGuestQuiz);

      // Verify quiz-level fields
      expect(quiz.id).toBe(mockLegacyGuestQuiz.id);
      expect(quiz.title).toBe(mockLegacyGuestQuiz.title);
      expect(quiz.description).toBe(mockLegacyGuestQuiz.description);
      expect(quiz.questions).toHaveLength(mockLegacyGuestQuiz.questions.length);
    });

    it("should convert question fields from legacy format", () => {
      const { quiz } = migrateLegacyQuiz(mockLegacyGuestQuiz);

      const firstQuestion = quiz.questions[0];

      // New format uses 'text' instead of 'question'
      expect(firstQuestion.text).toBe(
        mockLegacyGuestQuiz.questions[0].question,
      );
      expect(firstQuestion.multiple).toBe(
        mockLegacyGuestQuiz.questions[0].multiple,
      );
      // Legacy id becomes 'order' in new format
      expect(firstQuestion.order).toBe(1);
      // New id should be a UUID
      expect(firstQuestion.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should convert answer fields from legacy format", () => {
      const { quiz } = migrateLegacyQuiz(mockLegacyGuestQuiz);

      const firstAnswer = quiz.questions[0].answers[0];

      // New format uses 'text' instead of 'answer'
      expect(firstAnswer.text).toBe(
        mockLegacyGuestQuiz.questions[0].answers[0].answer,
      );
      // New format uses 'is_correct' instead of 'correct'
      expect(firstAnswer.is_correct).toBe(
        mockLegacyGuestQuiz.questions[0].answers[0].correct,
      );
      // Should have order field
      expect(firstAnswer.order).toBe(1);
      // Should have UUID id
      expect(firstAnswer.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should create question ID mapping for progress migration", () => {
      const { questionIdMap } = migrateLegacyQuiz(mockLegacyGuestQuiz);

      // Should map legacy numeric IDs to new UUIDs
      expect(questionIdMap.size).toBe(mockLegacyGuestQuiz.questions.length);
      expect(questionIdMap.has(1)).toBe(true);
      expect(questionIdMap.has(2)).toBe(true);
      expect(questionIdMap.has(3)).toBe(true);

      // All mapped values should be valid UUIDs
      for (const uuid of questionIdMap.values()) {
        expect(uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }
    });

    it("should generate UUID for quiz if id is not a string", () => {
      const quizWithNumericId = {
        ...mockLegacyGuestQuiz,
        id: undefined,
      };

      const { quiz } = migrateLegacyQuiz(quizWithNumericId);

      expect(quiz.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should handle questions without explicit IDs", () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const quizWithoutQuestionIds: LegacyQuiz = {
        title: "Quiz without IDs",
        questions: [
          {
            question: "First question",
            multiple: false,
            answers: [{ answer: "Answer", correct: true }],
          },
          {
            question: "Second question",
            multiple: false,
            answers: [{ answer: "Answer", correct: true }],
          },
        ],
      };

      const { quiz, questionIdMap } = migrateLegacyQuiz(quizWithoutQuestionIds);

      // Should fall back to index + 1 for order
      expect(quiz.questions[0].order).toBe(1);
      expect(quiz.questions[1].order).toBe(2);

      // ID mapping should still work
      expect(questionIdMap.has(1)).toBe(true);
      expect(questionIdMap.has(2)).toBe(true);
    });

    it("should handle empty or missing answer/question text", () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const quizWithEmptyFields: LegacyQuiz = {
        title: "Quiz with empty fields",
        questions: [
          {
            id: 1,
            question: undefined,
            multiple: false,
            answers: [{ answer: undefined, correct: true }],
          },
        ],
      };

      const { quiz } = migrateLegacyQuiz(quizWithEmptyFields);

      // Should default to empty strings
      expect(quiz.questions[0].text).toBe("");
      expect(quiz.questions[0].answers[0].text).toBe("");
    });

    it("should handle missing correct field in answers", () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const quizWithMissingCorrect: LegacyQuiz = {
        title: "Quiz",
        questions: [
          {
            id: 1,
            question: "Question",
            multiple: false,
            answers: [{ answer: "Answer without correct field" }],
          },
        ],
      };

      const { quiz } = migrateLegacyQuiz(quizWithMissingCorrect);

      // Should default to false
      expect(quiz.questions[0].answers[0].is_correct).toBe(false);
    });

    it("should set default quiz properties", () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const minimalQuiz: LegacyQuiz = {
        title: "Minimal Quiz",
        questions: [
          {
            id: 1,
            question: "Q?",
            multiple: false,
            answers: [{ answer: "A", correct: true }],
          },
        ],
      };

      const { quiz } = migrateLegacyQuiz(minimalQuiz);

      expect(quiz.version).toBe(1);
      expect(quiz.visibility).toBeDefined();
      expect(quiz.allow_anonymous).toBe(false);
      expect(quiz.is_anonymous).toBe(false);
      expect(quiz.creator).toBeNull();
    });

    it("should fallback to 'Untitled Quiz' if title is empty", () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const quizWithEmptyTitle: LegacyQuiz = {
        title: "",
        questions: [
          {
            id: 1,
            question: "Q?",
            multiple: false,
            answers: [{ answer: "A", correct: true }],
          },
        ],
      };

      const { quiz } = migrateLegacyQuiz(quizWithEmptyTitle);

      expect(quiz.title).toBe("Untitled Quiz");
    });
  });
});
