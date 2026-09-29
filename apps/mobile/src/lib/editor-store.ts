import type { Question } from "@testownik/core/quiz/types";
import { useSyncExternalStore } from "react";

import type { Translate } from "./user-error";

export interface EditorDraft {
  title: string;
  description: string;
  questions: Question[];
}

/**
 * The quiz editor's list screen owns the draft (loading, local recovery and
 * saving). Question and details screens pushed on top edit it through here.
 */
export interface EditorSession {
  draft: EditorDraft;
  update: (change: (draft: EditorDraft) => EditorDraft) => void;
  save: () => Promise<void>;
  addQuestion: () => string;
  uploadImage: () => Promise<{
    id: string;
    url?: string;
    width?: number;
    height?: number;
  } | null>;
  saving: boolean;
  uploads: number;
  canSave: boolean;
}

const sessions = new Map<string, EditorSession>();
const listeners = new Set<() => void>();

export function publishEditor(key: string, session: EditorSession | null) {
  if (session) sessions.set(key, session);
  else sessions.delete(key);
  for (const listener of listeners) listener();
}

export function useEditorSession(key: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => sessions.get(key) ?? null,
  );
}

/** A question nobody has started writing; not an error until saving fails. */
export function isBlankQuestion(question: Question) {
  return (
    !question.text.trim() &&
    !question.image &&
    !question.image_url &&
    !question.image_upload &&
    question.answers.every((answer) => !answer.text.trim() && !answer.image)
  );
}

/**
 * The first problem that would stop this question from saving (matches
 * editorValidation). Pass `answers: false` until the author has worked on the
 * answers or tried to save, so a fresh question isn't flagged mid-typing.
 */
export function questionIssue(
  question: Question,
  t: Translate,
  { answers = true }: { answers?: boolean } = {},
) {
  if (
    !question.text.trim() &&
    !question.image &&
    !question.image_url &&
    !question.image_upload
  )
    return t("Brak treści pytania", "Question text missing");
  if (!answers) return null;
  if (!question.answers.length) return t("Dodaj odpowiedź", "Add an answer");
  const empty = question.answers.findIndex(
    (answer) =>
      !answer.text.trim() &&
      !answer.image &&
      !answer.image_url &&
      !answer.image_upload,
  );
  if (empty !== -1)
    return t(
      `Odpowiedź ${empty + 1} jest pusta`,
      `Answer ${empty + 1} is empty`,
    );
  if (!question.answers.some((answer) => answer.is_correct))
    return t("Zaznacz poprawną odpowiedź", "Mark a correct answer");
  return null;
}
