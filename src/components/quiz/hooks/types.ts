import type { DataConnection } from "peerjs";

import type { AppContextType } from "@/app-context-type";
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
  state: {
    currentQuestion: Question | null;
    selectedAnswers: string[];
    questionChecked: boolean;
    isQuizFinished: boolean;
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
    resetProgress: () => Promise<void>;
    setSelectedAnswers: (a: string[]) => void;
    toggleBrainrot: () => void;
  };
}
