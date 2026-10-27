import type { StudyMode } from "@testownik/core/quiz/types";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function storageKey(quizId: string) {
  return `quiz-study-mode:${quizId}`;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readMode(quizId: string): StudyMode {
  try {
    return localStorage.getItem(storageKey(quizId)) === "flashcards"
      ? "flashcards"
      : "quiz";
  } catch {
    return "quiz";
  }
}

/**
 * How the quiz is studied on this device: as a quiz or as flashcards. Kept
 * per quiz in local storage; the server render sees the quiz mode.
 */
export function useStudyMode(quizId: string) {
  const mode = useSyncExternalStore(
    subscribe,
    () => readMode(quizId),
    () => "quiz" as StudyMode,
  );
  const setMode = (next: StudyMode) => {
    try {
      localStorage.setItem(storageKey(quizId), next);
    } catch {
      // Private browsing may refuse; the mode then lasts until a reload.
    }
    for (const listener of listeners) {
      listener();
    }
  };
  return [mode, setMode] as const;
}
