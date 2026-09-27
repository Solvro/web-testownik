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
} from "@testownik/core/quiz/types";
export type {
  AuthorizedApp,
  User,
  Group,
  GradesData,
  UserSettings,
  UserData,
} from "@testownik/core/user/types";
export type {
  StatsScope,
  QuizStats,
  PerQuestionStat,
  TimelineEntry,
  SessionEntry,
  HardestQuestion,
  HourlyEntry,
} from "@testownik/core/quiz/stats";
export type {
  WrappedData,
  WrappedStoryData,
  WrappedSeason,
  WrappedStudyTime,
  WrappedVolume,
  WrappedAccuracy,
  WrappedRhythm,
  WrappedPersona,
  WrappedTopQuiz,
  WrappedHardestQuestion,
  WrappedCreatorImpact,
  WrappedRank,
} from "@testownik/core/wrapped/types";
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
