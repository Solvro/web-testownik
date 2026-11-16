import type { Quiz, SharedQuiz } from "@testownik/core/quiz/types";

export interface ShareContentProps {
  quiz: Quiz;
  shares: SharedQuiz[] | undefined;
  sharesLoading: boolean;
  sharesError: unknown;
  quizError?: unknown;
  retryQuiz?: () => void;
  failureTitle?: string;
  retryShares: () => void;
  busy: boolean;
  failure: unknown;
  labels: string[];
  explanations: string[];
  linkNote: string;
  setVisibility: (value: number) => void;
  setAnonymousAccess: (allow: boolean) => void;
  setHideAuthor: (hide: boolean) => void;
  setRole: (share: SharedQuiz, allowEdit: boolean) => void;
  remove: (share: SharedQuiz) => void;
  invite: () => void;
  shareLink: () => void;
}
