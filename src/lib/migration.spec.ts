import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { migrateLegacyQuiz, runMigrations } from "@/lib/migration";
import type { QuizSession } from "@/types/quiz";
import type { LegacyQuiz, QuizProgress } from "@/types/quiz-legacy";

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

// eslint-disable-next-line @typescript-eslint/no-deprecated
const mockLegacyProgress: QuizProgress = {
  current_question: 2,
  correct_answers_count: 5,
  wrong_answers_count: 3,
  study_time: 180,
  reoccurrences: [
    { id: 1, reoccurrences: 0 }, // Mastered - should generate synthetic answer
    { id: 2, reoccurrences: 1 }, // Still pending - no answer
    { id: 3, reoccurrences: 0 }, // Mastered - should generate synthetic answer
  ],
};

// Mock localStorage
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    get length(): number {
      return Object.keys(store).length;
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
    // Helper for tests
    __getStore: (): Record<string, string> => store,
    __setStore: (newStore: Record<string, string>): void => {
      store = { ...newStore };
    },
  };
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
      expect(quiz.maintainer).toBeNull();
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

  describe("runMigrations", () => {
    let localStorageMock: ReturnType<typeof createLocalStorageMock>;
    let originalAlert: typeof window.alert;
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
      localStorageMock = createLocalStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
        writable: true,
      });

      // Mock alert
      originalAlert = window.alert;
      window.alert = vi.fn();

      // Mock URL methods for backup download
      originalCreateObjectURL = URL.createObjectURL.bind(URL);
      originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = vi.fn(() => "blob:test");
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      window.alert = originalAlert;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    it("should not run migration if DATA_VERSION is already 2", () => {
      localStorageMock.__setStore({
        DATA_VERSION: "2",
        guest_quizzes: JSON.stringify([mockLegacyGuestQuiz]),
      });

      runMigrations();

      // guest_quizzes should not be modified
      const storedQuizzes = JSON.parse(
        localStorageMock.getItem("guest_quizzes") ?? "[]",
      ) as unknown[];
      expect(
        (storedQuizzes[0] as Record<string, unknown>).questions,
      ).toBeDefined();
    });

    it("should migrate guest quizzes from legacy to new format", () => {
      localStorageMock.__setStore({
        DATA_VERSION: "0",
        guest_quizzes: JSON.stringify([mockLegacyGuestQuiz]),
      });

      runMigrations();

      const storedQuizzes = JSON.parse(
        localStorageMock.getItem("guest_quizzes") ?? "[]",
      ) as {
        questions: {
          text: string;
          answers: { text: string; is_correct: boolean }[];
        }[];
      }[];

      // Should be migrated to new format
      expect(storedQuizzes[0].questions[0].text).toBe(
        mockLegacyGuestQuiz.questions[0].question,
      );
      expect(storedQuizzes[0].questions[0].answers[0].text).toBe(
        mockLegacyGuestQuiz.questions[0].answers[0].answer,
      );
      expect(storedQuizzes[0].questions[0].answers[0].is_correct).toBe(
        mockLegacyGuestQuiz.questions[0].answers[0].correct,
      );
    });

    it("should migrate progress from reoccurrences to session format", () => {
      const quizId = mockLegacyGuestQuiz.id ?? "";
      localStorageMock.__setStore({
        DATA_VERSION: "0",
        guest_quizzes: JSON.stringify([mockLegacyGuestQuiz]),
        [`${quizId}_progress`]: JSON.stringify(mockLegacyProgress),
      });

      runMigrations();

      const storedProgress = JSON.parse(
        localStorageMock.getItem(`${quizId}_progress`) ?? "{}",
      ) as QuizSession;

      // Should have session format
      expect(storedProgress.answers).toBeDefined();
      expect(Array.isArray(storedProgress.answers)).toBe(true);
      expect(storedProgress.study_time).toBe(mockLegacyProgress.study_time);
      expect(storedProgress.is_active).toBe(true);
    });

    it("should create synthetic answer records for mastered questions", () => {
      const quizId = mockLegacyGuestQuiz.id ?? "";
      localStorageMock.__setStore({
        DATA_VERSION: "0",
        guest_quizzes: JSON.stringify([mockLegacyGuestQuiz]),
        [`${quizId}_progress`]: JSON.stringify(mockLegacyProgress),
      });

      runMigrations();

      const storedProgress = JSON.parse(
        localStorageMock.getItem(`${quizId}_progress`) ?? "{}",
      ) as QuizSession;

      // Questions with reoccurrences=0 should have synthetic correct answers
      // In mockLegacyProgress, ids 1 and 3 have reoccurrences=0
      const syntheticAnswers = storedProgress.answers.filter(
        (a) => a.was_correct,
      );
      expect(syntheticAnswers.length).toBe(2);

      // Synthetic answers should have empty selected_answers
      for (const answer of syntheticAnswers) {
        expect(answer.selected_answers).toEqual([]);
        expect(answer.was_correct).toBe(true);
      }
    });

    it("should set DATA_VERSION to 2 after successful migration", () => {
      localStorageMock.__setStore({
        DATA_VERSION: "0",
        guest_quizzes: JSON.stringify([mockLegacyGuestQuiz]),
      });

      runMigrations();

      expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
    });

    it("should skip already migrated progress (has answers array)", () => {
      const quizId = mockLegacyGuestQuiz.id ?? "";
      const alreadyMigratedProgress: QuizSession = {
        id: "session-id",
        started_at: new Date().toISOString(),
        ended_at: null,
        is_active: true,
        study_time: 100,
        current_question: "some-uuid",
        answers: [
          {
            id: "answer-1",
            question: "q1",
            answered_at: new Date().toISOString(),
            selected_answers: ["a1"],
            was_correct: true,
          },
        ],
      };

      localStorageMock.__setStore({
        DATA_VERSION: "0",
        guest_quizzes: JSON.stringify([mockLegacyGuestQuiz]),
        [`${quizId}_progress`]: JSON.stringify(alreadyMigratedProgress),
      });

      runMigrations();

      const storedProgress = JSON.parse(
        localStorageMock.getItem(`${quizId}_progress`) ?? "{}",
      ) as QuizSession;

      // Should not be modified
      expect(storedProgress.answers).toHaveLength(1);
      expect(storedProgress.answers[0].id).toBe("answer-1");
    });

    it("should handle empty guest_quizzes", () => {
      localStorageMock.__setStore({
        DATA_VERSION: "0",
        guest_quizzes: "",
      });

      expect(() => {
        runMigrations();
      }).not.toThrow();
      expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
    });

    it("should handle missing guest_quizzes key", () => {
      localStorageMock.__setStore({
        DATA_VERSION: "0",
      });

      expect(() => {
        runMigrations();
      }).not.toThrow();
      expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
    });

    it("should handle progress without matching quiz ID in mappings", () => {
      localStorageMock.__setStore({
        DATA_VERSION: "0",
        guest_quizzes: JSON.stringify([]),
        orphan_quiz_progress: JSON.stringify(mockLegacyProgress),
      });

      expect(() => {
        runMigrations();
      }).not.toThrow();

      const storedProgress = JSON.parse(
        localStorageMock.getItem("orphan_quiz_progress") ?? "{}",
      ) as QuizSession;

      // Should still migrate with generated UUIDs
      expect(storedProgress.answers).toBeDefined();
    });

    describe("first-time app opening", () => {
      it("should set DATA_VERSION to 2 on first app open with no data", () => {
        // Empty localStorage - first time user
        localStorageMock.__setStore({});

        expect(() => {
          runMigrations();
        }).not.toThrow();

        expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
      });

      it("should handle first app open with only DATA_VERSION missing", () => {
        localStorageMock.__setStore({
          some_unrelated_key: "value",
        });

        expect(() => {
          runMigrations();
        }).not.toThrow();

        expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
        // Unrelated data should be preserved
        expect(localStorageMock.getItem("some_unrelated_key")).toBe("value");
      });
    });

    describe("error handling", () => {
      /**
       * Note: The error handling path in runMigrations (catch block) is difficult
       * to trigger in tests because migrateGuestQuizzes and migrateQuizProgress
       * both have their own try-catch blocks that handle errors gracefully.
       *
       * These tests verify the graceful error handling behavior.
       */

      it("should handle corrupted guest_quizzes JSON gracefully", () => {
        localStorageMock.__setStore({
          DATA_VERSION: "0",
          guest_quizzes: "not valid json at all",
        });

        // Should not throw - error is caught in migrateGuestQuizzes
        expect(() => {
          runMigrations();
        }).not.toThrow();

        expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
      });

      it("should handle corrupted progress data gracefully", () => {
        // Progress data corruption is caught per-item in migrateQuizProgress
        localStorageMock.__setStore({
          DATA_VERSION: "0",
          guest_quizzes: JSON.stringify([mockLegacyGuestQuiz]),
          [`${mockLegacyGuestQuiz.id ?? ""}_progress`]: JSON.stringify({
            unexpected: "format",
          }),
        });

        // Should not throw - corrupted progress is handled per-item
        expect(() => {
          runMigrations();
        }).not.toThrow();

        expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
      });

      it("should continue migration even if one quiz fails to migrate", () => {
        // First quiz has invalid structure but second is valid
        const invalidQuiz = { title: null };

        localStorageMock.__setStore({
          DATA_VERSION: "0",
          guest_quizzes: JSON.stringify([invalidQuiz, mockLegacyGuestQuiz]),
        });

        // Migration should still succeed (errors are caught per-quiz)
        expect(() => {
          runMigrations();
        }).not.toThrow();

        expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
      });

      it("should preserve auth tokens and profile picture for authenticated users on corrupted data", () => {
        // Authenticated user with corrupted guest data
        localStorageMock.__setStore({
          DATA_VERSION: "0",
          is_guest: "false",
          access_token: "my-access-token",
          refresh_token: "my-refresh-token",
          profile_picture: "https://example.com/pic.jpg",
          guest_quizzes: "corrupted json",
        });

        expect(() => {
          runMigrations();
        }).not.toThrow();

        // Auth tokens and profile picture should still be present
        expect(localStorageMock.getItem("DATA_VERSION")).toBe("2");
        expect(localStorageMock.getItem("access_token")).toBe(
          "my-access-token",
        );
        expect(localStorageMock.getItem("refresh_token")).toBe(
          "my-refresh-token",
        );
        expect(localStorageMock.getItem("profile_picture")).toBe(
          "https://example.com/pic.jpg",
        );
      });
    });
  });
});
