import { validateLegacyQuiz } from "@/components/quiz/helpers/legacy-quiz-validation";
import { validateQuiz } from "@/components/quiz/helpers/quiz-validation";
import { prepareQuizForSubmission } from "@/lib/schemas/quiz.schema";
import type { QuizService } from "@/services/quiz.service";
import { STORAGE_KEYS } from "@/services/types";
import type { Answer, Question, Quiz } from "@/types/quiz";
import type { LegacyQuiz } from "@/types/quiz-legacy";

import { migrateLegacyQuiz } from "./migration";

export interface LegacyGuestQuizMigrationResult {
  migratedCount: number;
  failedCount: number;
  skippedCount: number;
}

function extractStoredQuizEntries(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return [];
  }

  if (
    "quizzes" in parsed &&
    Array.isArray((parsed as { quizzes?: unknown }).quizzes)
  ) {
    return (parsed as { quizzes: unknown[] }).quizzes;
  }

  return Object.values(parsed);
}

function normalizeQuizForSubmission(quiz: Quiz) {
  return prepareQuizForSubmission({
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions.map((question: Question) => ({
      id: question.id,
      order: question.order,
      text: question.text,
      explanation: question.explanation,
      multiple: question.multiple,
      image: question.image ?? null,
      image_url: question.image_url ?? question.image ?? null,
      image_upload: question.image_upload ?? null,
      image_width: question.image_width ?? null,
      image_height: question.image_height ?? null,
      answers: question.answers.map((answer: Answer) => ({
        id: answer.id,
        order: answer.order,
        text: answer.text,
        is_correct: answer.is_correct,
        image: answer.image ?? null,
        image_url: answer.image_url ?? answer.image ?? null,
        image_upload: answer.image_upload ?? null,
        image_width: answer.image_width ?? null,
        image_height: answer.image_height ?? null,
      })),
    })),
  });
}

function toSubmissionPayload(storedQuiz: unknown): {
  title: string;
  description: string;
  questions: unknown[];
} | null {
  if (validateQuiz(storedQuiz) === null) {
    return normalizeQuizForSubmission(storedQuiz as Quiz);
  }

  if (validateLegacyQuiz(storedQuiz) === null) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const { quiz } = migrateLegacyQuiz(storedQuiz as LegacyQuiz);
    return normalizeQuizForSubmission(quiz);
  }

  return null;
}

export async function migrateLegacyGuestQuizzes(
  quizService: Pick<QuizService, "createQuiz">,
): Promise<LegacyGuestQuizMigrationResult> {
  const stored = localStorage.getItem(STORAGE_KEYS.GUEST_QUIZZES);

  if (stored === null || stored.trim() === "") {
    return { migratedCount: 0, failedCount: 0, skippedCount: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored) as unknown;
  } catch (error) {
    console.error(
      "Failed to parse legacy guest quizzes from localStorage:",
      error,
    );
    return { migratedCount: 0, failedCount: 0, skippedCount: 0 };
  }

  const entries = extractStoredQuizEntries(parsed);
  if (entries.length === 0) {
    return { migratedCount: 0, failedCount: 0, skippedCount: 0 };
  }

  const remainingEntries: unknown[] = [];
  let migratedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const payload = toSubmissionPayload(entry);

    if (payload === null) {
      skippedCount += 1;
      remainingEntries.push(entry);
      continue;
    }

    try {
      await quizService.createQuiz(payload);
      migratedCount += 1;
    } catch (error) {
      console.error("Failed to migrate legacy guest quiz:", error);
      failedCount += 1;
      remainingEntries.push(entry);
    }
  }

  if (remainingEntries.length === 0) {
    localStorage.removeItem(STORAGE_KEYS.GUEST_QUIZZES);
  } else {
    localStorage.setItem(
      STORAGE_KEYS.GUEST_QUIZZES,
      JSON.stringify(remainingEntries),
    );
  }

  return { migratedCount, failedCount, skippedCount };
}
