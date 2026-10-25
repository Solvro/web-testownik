export type StatsScope = "me" | "all";

export interface QuizStats {
  quiz_id: string;
  total_answers: number;
  correct_answers: number;
  wrong_answers: number;
  accuracy: number;
  first_answer_accuracy: number;
  study_time_seconds: number | null;
  total_study_time_seconds: number;
  average_study_time_seconds: number;
  sessions_count: number;
  unique_users_count: number | null;
  last_activity_at: string | null;
  per_question?: PerQuestionStat[];
}

export interface PerQuestionStat {
  question_id: string;
  attempts: number;
  correct_attempts: number;
  last_answered_at: string | null;
}

export interface TimelineEntry {
  date: string;
  sessions_count: number;
  total_answers: number;
  correct_answers: number;
  total_study_time_seconds: number;
}

export interface SessionEntry {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  study_time_seconds: number;
  total_answers: number;
  correct_answers: number;
  accuracy: number;
}

export interface HardestQuestion {
  question_id: string;
  question_text: string;
  wrong_answers: number;
  total_answers: number;
}

export interface HourlyEntry {
  hour: number;
  sessions_count: number;
}
