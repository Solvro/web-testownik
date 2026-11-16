import type { Question, Quiz } from "@testownik/core/quiz/types";

export interface EditorDraft {
  schemaVersion?: 1;
  baseVersion?: number;
  title: string;
  description: string;
  questions: Question[];
}

export function isQuizVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** Legacy drafts sometimes retained the full Quiz, including its original version. */
export function restoreEditorDraft(
  saved: EditorDraft & { version?: unknown },
): EditorDraft {
  const candidate =
    saved.schemaVersion === 1
      ? saved.baseVersion
      : saved.schemaVersion === undefined
        ? saved.version
        : undefined;
  return {
    schemaVersion: 1,
    ...(isQuizVersion(candidate) ? { baseVersion: candidate } : {}),
    title: saved.title,
    description: saved.description ?? "",
    questions: saved.questions,
  };
}

export function editorDraftFromQuiz(quiz: Quiz): EditorDraft {
  return {
    schemaVersion: 1,
    ...(isQuizVersion(quiz.version) ? { baseVersion: quiz.version } : {}),
    title: quiz.title,
    description: quiz.description ?? "",
    questions: quiz.questions,
  };
}
