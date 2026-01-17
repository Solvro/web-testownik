import type { LegacyQuiz, QuizProgress } from "@/types/quiz-legacy.ts";
import type {
  Answer,
  AnswerRecord,
  Question,
  Quiz,
  QuizSession,
} from "@/types/quiz.ts";
import { AccessLevel } from "@/types/quiz.ts";

const DATA_VERSION_KEY = "DATA_VERSION";

/**
 * Run all pending migrations on app startup
 */
export function runMigrations(): void {
  const version = Number(localStorage.getItem(DATA_VERSION_KEY) ?? "0");

  if (version < 2) {
    const backup = createGuestDataBackup();
    try {
      migrateToV2();
      localStorage.setItem(DATA_VERSION_KEY, "2");
      // Migration successful
    } catch (error) {
      console.error("[Migration] Failed to migrate to v2:", error);
      if (localStorage.getItem("is_guest") !== "true") {
        // Preserve auth tokens so user stays logged in
        const accessToken = localStorage.getItem("access_token");
        const refreshToken = localStorage.getItem("refresh_token");
        const profilePicture = localStorage.getItem("profile_picture");
        localStorage.clear();
        if (accessToken !== null) {
          localStorage.setItem("access_token", accessToken);
        }
        if (refreshToken !== null) {
          localStorage.setItem("refresh_token", refreshToken);
        }
        if (profilePicture !== null) {
          localStorage.setItem("profile_picture", profilePicture);
        }
        localStorage.setItem(DATA_VERSION_KEY, "2");
        return; // All data is already on the server so we can just ignore this
      }
      downloadBackup(backup);
      // eslint-disable-next-line no-alert
      const shouldContinue = confirm(
        "Nie udało się zaktualizować danych zapisanych lokalnie.\n\nKopia zapasowa została pobrana, czy chcesz wyczyścić dane aplikacji i ją zresetować?",
      );
      if (shouldContinue) {
        localStorage.clear();
        localStorage.setItem(DATA_VERSION_KEY, "2");
        location.reload();
      } else {
        throw new Error("Migration failed");
      }
    }
  }
}

/**
 * Migration to v2: Convert to session-based progress (from reoccurrences to answers)
 */
function migrateToV2(): void {
  const idMappings = migrateGuestQuizzes();
  migrateQuizProgress(idMappings);
}

/**
 * Migrate guest quizzes stored in localStorage.
 * Returns a map of quiz ID -> (legacy question ID -> new UUID) for progress migration.
 */
function migrateGuestQuizzes(): Map<string, Map<number, string>> {
  const stored = localStorage.getItem("guest_quizzes");
  if (stored === null || stored.trim() === "") {
    return new Map();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const quizzes = JSON.parse(stored) as LegacyQuiz[];

    const idMappings = new Map<string, Map<number, string>>();

    const migratedQuizzes = quizzes.map((quiz) => {
      const { quiz: migratedQuiz, questionIdMap } = migrateLegacyQuiz(quiz);
      idMappings.set(migratedQuiz.id, questionIdMap);
      return migratedQuiz;
    });

    localStorage.setItem("guest_quizzes", JSON.stringify(migratedQuizzes));

    return idMappings;
  } catch (error) {
    console.error("[Migration] Failed to migrate guest quizzes:", error);
    return new Map();
  }
}

/**
 * Migrate quiz progress to session format.
 * @param idMappings Map of quiz ID -> (legacy question ID -> new UUID) from quiz migration
 */
function migrateQuizProgress(
  idMappings: Map<string, Map<number, string>>,
): void {
  const progressKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (key !== null && key.endsWith("_progress")) {
      progressKeys.push(key);
    }
  }

  for (const key of progressKeys) {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const progress = JSON.parse(stored) as QuizProgress | QuizSession;

      // Check if already in new session format (has 'answers' array)
      if ("answers" in progress && Array.isArray(progress.answers)) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const legacyProgress = progress as QuizProgress;

      const quizId = key.replace("_progress", "");
      const questionIdMap = idMappings.get(quizId);

      // Create synthetic answers array from reoccurrences
      // For questions with reoccurrences=0, they were answered correctly once
      // For questions with reoccurrences>0, they still need to be answered
      //
      // NOTE: Synthetic answer records have empty selected_answers since we don't
      // have historical selection data. This affects analytics that rely on answer
      // history but preserves the correct mastery state via was_correct.
      const syntheticAnswers: AnswerRecord[] = [];

      for (const r of legacyProgress.reoccurrences) {
        const questionId = questionIdMap?.get(r.id) ?? crypto.randomUUID();

        // If reoccurrences is 0, the question was mastered (answered correctly)
        // We create a synthetic "correct" answer
        if (r.reoccurrences === 0) {
          syntheticAnswers.push({
            id: crypto.randomUUID(),
            question_id: questionId,
            answered_at: new Date().toISOString(),
            selected_answers: [], // Historical data unavailable during migration
            was_correct: true,
          });
        }
        // Questions with reoccurrences > 0 are still pending, no answers needed
      }

      const currentQuestionId =
        questionIdMap?.get(legacyProgress.current_question) ?? null;

      const migratedSession: QuizSession = {
        id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        ended_at: null,
        is_active: true,
        study_time: legacyProgress.study_time,
        correct_count: legacyProgress.correct_answers_count,
        wrong_count: legacyProgress.wrong_answers_count,
        current_question: currentQuestionId,
        answers: syntheticAnswers,
      };

      localStorage.setItem(key, JSON.stringify(migratedSession));
    } catch (error) {
      console.error(`[Migration] Failed to migrate progress ${key}:`, error);
    }
  }
}

/**
 * Create a full backup of all guest data (quizzes, progress, settings).
 * Returns the backup data as a JSON string.
 */
export function createGuestDataBackup(): string {
  const quizzesString = localStorage.getItem("guest_quizzes");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let quizzes: any[] = [];

  if (quizzesString !== null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      quizzes = JSON.parse(quizzesString);
    } catch (error) {
      console.error("Error parsing guest_quizzes for backup", error);
    }
  }

  const backup: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    quizzes,
    settings: localStorage.getItem("settings"),
  };

  // Add progress for each quiz
  for (const quiz of quizzes) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const quizId = String(quiz.id ?? "");
    if (quizId) {
      const progress = localStorage.getItem(`${quizId}_progress`);
      if (progress !== null) {
        backup[`progress_${quizId}`] = JSON.parse(progress);
      }
    }
  }

  return JSON.stringify(backup, null, 2);
}

/**
 * Migrates a legacy quiz object to the current Quiz format.
 * Returns both the migrated quiz and a map of legacy question IDs (numbers) to new question IDs (UUIDs).
 */
export function migrateLegacyQuiz(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  legacy: LegacyQuiz,
): { quiz: Quiz; questionIdMap: Map<number, string> } {
  const quizId =
    typeof legacy.id === "string" ? legacy.id : crypto.randomUUID();
  const questionIdMap = new Map<number, string>();

  const questions: Question[] = legacy.questions.map(
    (question, index: number) => {
      const newId = crypto.randomUUID();
      const legacyId =
        typeof question.id === "number" ? question.id : index + 1;
      questionIdMap.set(legacyId, newId);

      // Migrate answers
      const answers: Answer[] = question.answers.map((answer, answerIndex) => ({
        id: crypto.randomUUID(),
        order: answerIndex + 1,
        text: answer.answer ?? "",
        is_correct: answer.correct ?? false,
        image: answer.image,
      }));

      return {
        id: newId,
        order: legacyId, // Move old id to order
        text: question.question ?? "",
        explanation: question.explanation,
        multiple: question.multiple,
        image: question.image,
        answers,
      } as Question;
    },
  );

  const quiz: Quiz = {
    id: quizId,
    title: legacy.title || "Untitled Quiz",
    description: legacy.description ?? "",
    questions,
    version: 1,
    visibility: AccessLevel.PRIVATE,
    allow_anonymous: false,
    is_anonymous: false,
    maintainer: null,
  };

  return { quiz, questionIdMap };
}

function downloadBackup(data: string) {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `testownik-backup-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
