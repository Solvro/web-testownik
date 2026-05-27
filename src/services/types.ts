// Re-export types from components
export type {
  QuizBase,
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
export type {
  StatsScope,
  QuizStats,
  PerQuestionStat,
  TimelineEntry,
  SessionEntry,
  HardestQuestion,
  HourlyEntry,
} from "@/types/quiz-stats";
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
} as const;
