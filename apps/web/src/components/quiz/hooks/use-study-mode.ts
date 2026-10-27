import type { StudyMode } from "@testownik/core/quiz/types";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
// The modes chosen in this page, for when local storage refuses to write.
const memory = new Map<string, StudyMode>();

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
    const stored = localStorage.getItem(storageKey(quizId));
    if (stored === "flashcards" || stored === "quiz") {
      return stored;
    }
  } catch {
    // Private browsing may refuse; fall back to what was chosen here.
  }
  return memory.get(quizId) ?? "quiz";
}

/**
 * How the quiz is studied on this device: as a quiz or as flashcards. Kept
 * per quiz in local storage; the server render sees the quiz mode.
 */
export function useStudyMode(quizId: string) {
  const mode = useSyncExternalStore(
    subscribe,
    () => readMode(quizId),
    () => "quiz",
  );
  const setMode = (next: StudyMode) => {
    memory.set(quizId, next);
    try {
      localStorage.setItem(storageKey(quizId), next);
    } catch {
      // Kept in memory for this page only.
    }
    for (const listener of listeners) {
      listener();
    }
  };
  return [mode, setMode] as const;
}
