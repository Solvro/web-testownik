import type { DataConnection } from "peerjs";

import type { AppContextType } from "@/app-context-type";
import type { QuizHistory } from "@/components/quiz/hooks/use-quiz-history.ts";
import type { Question, Quiz, Reoccurrence } from "@/types/quiz.ts";
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
  history: QuizHistory[];
  state: {
    currentQuestion: Question | null;
    selectedAnswers: number[];
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
    reoccurrences: Reoccurrence[];
    studyTime: number;
  };
  continuity: {
    isHost: boolean;
    peerConnections: DataConnection[];
  };
  actions: {
    nextAction: () => void;
    nextQuestion: () => void;
    goBack: () => void;
    resetProgress: () => Promise<void>;
    setSelectedAnswers: (a: number[]) => void;
    toggleHistory: () => void;
    toggleBrainrot: () => void;
  };
}

export interface UseQuizHistoryLogicParameters {
  quizId: string;
}

export interface UseQuizHistoryLogicResult {
  history: QuizHistory[];
  state: {
    canGoBack: boolean;
  };
  actions: {
    addHistoryEntry: (question: Question, answers: number[]) => void;
    clearHistory: () => void;
  };
}
