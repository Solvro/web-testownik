import type { Quiz } from "@testownik/core/quiz/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrateLegacyGuestQuizzes } from "@/lib/legacy-guest-quiz-migration";
import { STORAGE_KEYS } from "@/services/types";
import type { LegacyQuiz } from "@/types/quiz-legacy";

const currentQuiz: Quiz = {
  id: "quiz-1",
  title: "Current quiz",
  description: "desc",
  version: 1,
  visibility: 0,
  allow_anonymous: false,
  is_anonymous: false,
  creator: null,
  questions: [
    {
      id: "q-1",
      order: 1,
      text: "Question?",
      type: "single_choice",
      shuffle_answers: true,
      open_matching: "exact",
      answers: [
        {
          id: "a-1",
          order: 1,
          text: "Answer",
          is_correct: true,
        },
      ],
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-deprecated
const legacyQuiz: LegacyQuiz = {
  title: "Legacy quiz",
  description: "legacy desc",
  questions: [
    {
      id: 1,
      question: "Legacy question?",
      multiple: false,
      answers: [{ answer: "Legacy answer", correct: true }],
    },
  ],
};

describe("migrateLegacyGuestQuizzes", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("migrates current-format quizzes and clears storage on success", async () => {
    localStorage.setItem(
      STORAGE_KEYS.GUEST_QUIZZES,
      JSON.stringify([currentQuiz]),
    );
    const createQuiz = vi.fn().mockResolvedValue({ id: "new-id" });

    const result = await migrateLegacyGuestQuizzes({ createQuiz });

    expect(result).toEqual({
      migratedCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
    expect(createQuiz).toHaveBeenCalledTimes(1);
    expect(createQuiz).toHaveBeenCalledWith({
      title: "Current quiz",
      description: "desc",
      questions: [
        {
          id: "q-1",
          order: 1,
          text: "Question?",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          explanation: undefined,
          image_url: null,
          image_upload: null,
          answers: [
            {
              id: "a-1",
              order: 1,
              text: "Answer",
              is_correct: true,
              image_url: null,
              image_upload: null,
            },
          ],
        },
      ],
    });
    expect(localStorage.getItem(STORAGE_KEYS.GUEST_QUIZZES)).toBeNull();
  });

  it("normalizes old stored current-format questions without leaking multiple", async () => {
    const storedQuiz = {
      ...currentQuiz,
      questions: currentQuiz.questions.map(
        ({ type, shuffle_answers, open_matching, ...question }) => ({
          ...question,
          multiple: false,
          answers: [
            ...question.answers,
            { id: "a-2", order: 2, text: "Another answer", is_correct: true },
          ],
        }),
      ),
    };
    localStorage.setItem(
      STORAGE_KEYS.GUEST_QUIZZES,
      JSON.stringify([storedQuiz]),
    );
    const createQuiz = vi.fn().mockResolvedValue({ id: "new-id" });
    expect(await migrateLegacyGuestQuizzes({ createQuiz })).toEqual({
      migratedCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
    const payload = createQuiz.mock.calls[0][0] as {
      questions: Record<string, unknown>[];
    };
    expect(payload.questions[0]).toMatchObject({
      type: "multiple_choice",
      shuffle_answers: true,
      open_matching: "exact",
    });
    expect(payload.questions[0]).not.toHaveProperty("multiple");
  });

  it("migrates legacy quizzes automatically", async () => {
    localStorage.setItem(
      STORAGE_KEYS.GUEST_QUIZZES,
      JSON.stringify([legacyQuiz]),
    );
    const createQuiz = vi.fn().mockResolvedValue({ id: "new-id" });

    const result = await migrateLegacyGuestQuizzes({ createQuiz });

    expect(result).toEqual({
      migratedCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
    expect(createQuiz).toHaveBeenCalledTimes(1);
    const payload = createQuiz.mock.calls[0][0] as {
      title: string;
      description: string;
      questions: { text: string; answers: { text: string }[] }[];
    };
    expect(payload.title).toBe("Legacy quiz");
    expect(payload.questions[0].text).toBe("Legacy question?");
    expect(payload.questions[0].answers[0].text).toBe("Legacy answer");
    expect(localStorage.getItem(STORAGE_KEYS.GUEST_QUIZZES)).toBeNull();
  });

  it("keeps only failed quizzes in storage for retry", async () => {
    localStorage.setItem(
      STORAGE_KEYS.GUEST_QUIZZES,
      JSON.stringify([currentQuiz, legacyQuiz]),
    );
    const createQuiz = vi
      .fn()
      .mockResolvedValueOnce({ id: "ok" })
      .mockRejectedValueOnce(new Error("boom"));

    const result = await migrateLegacyGuestQuizzes({ createQuiz });

    expect(result).toEqual({
      migratedCount: 1,
      failedCount: 1,
      skippedCount: 0,
    });
    expect(createQuiz).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.GUEST_QUIZZES) ?? "[]"),
    ).toHaveLength(1);
  });

  it("supports object-based legacy storage shape", async () => {
    localStorage.setItem(
      STORAGE_KEYS.GUEST_QUIZZES,
      JSON.stringify({ first: currentQuiz, second: legacyQuiz }),
    );
    const createQuiz = vi.fn().mockResolvedValue({ id: "new-id" });

    const result = await migrateLegacyGuestQuizzes({ createQuiz });

    expect(result).toEqual({
      migratedCount: 2,
      failedCount: 0,
      skippedCount: 0,
    });
    expect(createQuiz).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(STORAGE_KEYS.GUEST_QUIZZES)).toBeNull();
  });
});
