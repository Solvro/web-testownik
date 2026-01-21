// Re-export types from components
export type {
  Quiz,
  QuizMetadata,
  SharedQuiz,
  QuestionWithQuizInfo,
  AnswerRecord,
  QuizSession,
  QuizWithUserProgress,
} from "@/types/quiz";
export type {
  User,
  Group,
  GradesData,
  UserSettings,
  UserData,
} from "@/types/user";
export type { AlertData } from "@/types/alert";

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// Storage keys for localStorage
export const STORAGE_KEYS = {
  GUEST_QUIZZES: "guest_quizzes",
  IS_GUEST: "is_guest",
  SETTINGS: "settings",
  QUIZ_PROGRESS: (quizId: string) => `${quizId}_progress`,
} as const;
