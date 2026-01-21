import type { DataConnection } from "peerjs";

import type { AppContextType } from "@/app-context-type";
import type {
  HistoryEntry,
  QuizHistory,
} from "@/components/quiz/hooks/use-quiz-history.ts";
import type { AnswerRecord, Question, Quiz } from "@/types/quiz.ts";
import type { UserSettings } from "@/types/user.ts";

export interface UseQuizLogicParameters {
  quizId: string;
  appContext: AppContextType;
  onQuizLoaded?: (quiz: Quiz) => void;
}

export interface UseQuizLogicResult {
  loading: boolean;
  quiz: Quiz | null;
  userSettings: UserSettings;
  history: QuizHistory;
  state: {
    currentQuestion: Question | null;
    selectedAnswers: string[];
    questionChecked: boolean;
    isQuizFinished: boolean;
    canGoBack: boolean;
    isHistoryQuestion: boolean;
    showHistory: boolean;
    showBrainrot: boolean;
  };
  stats: {
    correctAnswersCount: number;
    wrongAnswersCount: number;
    masteredCount: number;
    totalQuestions: number;
    studyTime: number;
    answers: AnswerRecord[];
  };
  continuity: {
    isHost: boolean;
    peerConnections: DataConnection[];
  };
  actions: {
    nextAction: () => void;
    skipQuestion: () => void;
    openHistoryQuestion: (historyQuestion?: HistoryEntry) => void;
    resetProgress: () => Promise<void>;
    setSelectedAnswers: (a: string[]) => void;
    toggleHistory: () => void;
    toggleBrainrot: () => void;
  };
}

export interface UseHistoryLogicParameters {
  quizId: string;
}

export interface UseHistoryLogicResult {
  history: QuizHistory;
  state: {
    canGoBack: boolean;
  };
  actions: {
    addHistoryEntry: (question: Question, answers: string[]) => void;
    setCurrentHistoryQuestion: (question: Question) => void;
    clearHistory: () => void;
  };
}
