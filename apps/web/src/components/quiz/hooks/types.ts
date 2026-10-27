import type {
  Question,
  Quiz,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import type { UserSettings } from "@testownik/core/user/types";
import type { DataConnection } from "peerjs";

import type { TimerStore } from "./use-study-timer";

export interface UseQuizLogicParameters {
  quizId: string;
  onQuizLoaded?: (quiz: Quiz) => void;
}

export interface UseQuizLogicResult {
  quiz: QuizWithUserProgress;
  userSettings: UserSettings;
  state: {
    currentQuestion: Question | null;
    selectedAnswers: string[];
    questionChecked: boolean;
    /** The grade of the history record shown, or null for the current question. */
    wasCorrect: boolean | null;
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
    isDisconnected: boolean;
    isHost: boolean;
    peerConnections: DataConnection[];
    disconnect: () => void;
    reconnect: () => void;
  };
  actions: {
    nextAction: () => void;
    skipQuestion: () => void;
    /**
     * Records a flashcard the learner graded themselves and moves on. With
     * `questionId`, only while that question is still the current one.
     */
    gradeSelf: (knew: boolean, questionId?: string) => void;
    resetProgress: () => Promise<void>;
    setSelectedAnswers: (a: string[]) => void;
    onQuestionDeleted: (
      deletedQuestionId: string,
      newCurrentQuestionId: string | null,
    ) => void;
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
