import type { QuizListActions, QuizListItem } from "../quiz-list/types";

export interface HomeContentProps extends QuizListActions {
  continueQuiz?: QuizListItem;
  recent: QuizListItem[];
  savedCount: number;
  loading: boolean;
  error: unknown;
  sync: {
    offline: boolean;
    pending: number;
    error: unknown;
    run: () => void;
  };
  refresh: () => Promise<unknown>;
  retry: () => void;
  createQuiz: () => void;
  importQuiz: () => void;
  openLibrary: () => void;
  openSaved: () => void;
}
