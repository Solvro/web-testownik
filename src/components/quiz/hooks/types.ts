import type { DataConnection } from "peerjs";

import type { AppContextType } from "@/app-context-type";
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
