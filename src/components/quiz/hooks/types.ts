import type { DataConnection } from "peerjs";

import type { AppContextType } from "@/app-context.tsx";

import type { Question, Quiz, Reoccurrence } from "../types";

export interface UserSettings {
  sync_progress: boolean;
  initial_reoccurrences: number;
  wrong_answer_reoccurrences: number;
}

export interface Progress {
  current_question: number;
  correct_answers_count: number;
  wrong_answers_count: number;
  study_time: number;
  last_activity?: string;
  reoccurrences: Reoccurrence[];
}

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
    selectedAnswers: number[];
    questionChecked: boolean;
    isQuizFinished: boolean;
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
    resetProgress: () => Promise<void>;
    setSelectedAnswers: (a: number[]) => void;
    toggleBrainrot: () => void;
  };
}
