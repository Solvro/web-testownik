import type { QueryClient } from "@tanstack/react-query";

import type { TimerStore } from "@/components/quiz/hooks/use-study-timer";

import type { QuizPreviewState, QuizPreviewView } from "./preview-quiz-machine";

/** Screens sharing a session share the quiz, timer and settings, not their menus. */
export interface PreviewQuizSession {
  state: QuizPreviewState;
  view: QuizPreviewView;
  select: (answers: string[]) => void;
  /** Checks the answer, or moves on once it is checked. */
  next: () => void;
  /** The quiz card's back button: shows the previous answer, or returns. */
  back: () => void;
  reset: () => void;
  setFocusMode: (active: boolean) => void;
  goTo: (questionId: string) => void;
  timer: TimerStore;
  /** Preview-local data: the settings dialog's cache and the stats queries. */
  client: QueryClient;
}
