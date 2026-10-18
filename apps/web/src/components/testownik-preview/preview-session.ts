import type { QueryClient } from "@tanstack/react-query";

import type { TimerStore } from "@/components/quiz/hooks/use-study-timer";

import type { QuizPreviewState, QuizPreviewView } from "./preview-quiz-machine";

/**
 * One preview quiz session, as the screens consume it. Every screen handed
 * the same session shows the same quiz, progress, timer and (through the
 * shared query cache) settings; menus, dialogs and the stats view stay local
 * to each screen.
 */
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
  timer: TimerStore;
  /** Preview-local data: the settings dialog's cache and the stats queries. */
  client: QueryClient;
}
