import type { DataConnection } from "peerjs";

import type { AppContextType } from "@/app-context-type";
import type { Question, Quiz, QuizWithUserProgress } from "@/types/quiz";
import type { UserSettings } from "@/types/user";

import type { TimerStore } from "./use-study-timer";

export interface UseQuizLogicParameters {
  quizId: string;
  appContext: AppContextType;
  onQuizLoaded?: (quiz: Quiz) => void;
}

export interface UseQuizLogicResult {
  quiz: QuizWithUserProgress;
  userSettings: UserSettings;
  state: {
    currentQuestion: Question | null;
    selectedAnswers: string[];
    questionChecked: boolean;
    isQuizFinished: boolean;
    showHistory: boolean;
    isHistoryQuestion: boolean;
    canGoBack: boolean;
    showBrainrot: boolean;
  };
  stats: {
    correctAnswersCount: number;
    wrongAnswersCount: number;
    masteredCount: number;
    totalQuestions: number;
    timerStore: TimerStore;
  };
  continuity: {
    isHost: boolean;
    peerConnections: DataConnection[];
  };
  actions: {
    nextAction: () => void;
    skipQuestion: () => void;
    resetProgress: () => Promise<void>;
    setSelectedAnswers: (a: string[]) => void;
    toggleHistory: () => void;
    toggleBrainrot: () => void;
    togglePreviousQuestion: () => void;
  };
}

export interface ClientState {
  selectedAnswers: string[];
  questionChecked: boolean;
  nextQuestionId: string | null;
}
