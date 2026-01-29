import type { DataConnection } from "peerjs";

import type { AppContextType } from "@/app-context-type";
import type { AnswerRecord, Question, Quiz } from "@/types/quiz";
import type { UserSettings } from "@/types/user";

import type { TimerStore } from "./use-study-timer";

export interface UseQuizLogicParameters {
  quizId: string;
  appContext: AppContextType;
  onQuizLoaded?: (quiz: Quiz) => void;
}

export interface UseQuizLogicResult {
  loading: boolean;
  quiz: Quiz | null;
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
    answers: AnswerRecord[];
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
    goToPreviousQuestion: () => void;
  };
}
