// Re-export types from components
export type {
  Quiz,
  QuizMetadata,
  SharedQuiz,
  QuestionWithQuizInfo,
  AnswerRecord,
  QuizSession,
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

export const STORAGE_KEYS = {
  GUEST_QUIZZES: "guest_quizzes",
  ACCESS_TOKEN: "access_token",
  ACCESS_TOKEN_EXPIRES_AT: "access_token_expires_at",
  REFRESH_TOKEN: "refresh_token",
  PROFILE_PICTURE: "profile_picture",
  IS_STAFF: "is_staff",
  USER_ID: "user_id",
  IS_GUEST: "is_guest",
  SETTINGS: "settings",
  QUIZ_PROGRESS: (quizId: string) => `${quizId}_progress`,
} as const;
