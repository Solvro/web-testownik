import type {
  QuizMetadata,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import { deriveSettings, getMasteredCount } from "@testownik/core/quiz/session";
import type { Language } from "./locale";

/** Mastery of the cached active session, using exactly the same rules as Study. */
export function studyProgress(
  quiz: Pick<QuizMetadata, "id" | "version">,
  cached: QuizWithUserProgress | undefined,
): { mastered: number; total: number } | null {
  if (
    !cached ||
    cached.id !== quiz.id ||
    cached.version !== quiz.version ||
    !cached.questions.length ||
    !cached.current_session?.is_active ||
    cached.current_session.ended_at ||
    !cached.current_session.answers.length
  )
    return null;
  return {
    mastered: getMasteredCount(
      cached.questions,
      cached.current_session.answers,
      deriveSettings(cached.user_settings),
    ),
    total: cached.questions.length,
  };
}

/** Resume the cached session using exactly the same mastery rules as Study. */
export function studySummary(
  quiz: Pick<QuizMetadata, "id" | "version">,
  cached: QuizWithUserProgress | undefined,
  language: Language,
): string | null {
  const progress = studyProgress(quiz, cached);
  if (!progress) return null;
  return language === "pl"
    ? `Opanowane pytania: ${progress.mastered} z ${progress.total}`
    : `${progress.mastered} of ${progress.total} questions mastered`;
}
