import type { Group, User, UserSettings } from "./user";

export interface QuizMetadata {
  id: string;
  title: string;
  description: string;
  maintainer?: User | null;
  visibility: AccessLevel;
  allow_anonymous: boolean;
  is_anonymous: boolean;
  version: number;
  can_edit?: boolean;
  preview_question?: Question;
  question_count?: number;
}

export interface Answer {
  id: string;
  order: number;
  text: string;
  is_correct: boolean;
  image?: string | null; // Read-only (Display)
  image_url?: string | null; // Write-only (Input for external URLs)
  image_upload?: string | null; // Write-only (UUID from /api/upload/)
  image_width?: number | null; // Read-only (Display)
  image_height?: number | null; // Read-only (Display)
}

export interface Question {
  id: string;
  order: number;
  text: string;
  explanation?: string;
  multiple: boolean; // Single or multiple choice
  image?: string | null; // Read-only (Display)
  image_url?: string | null; // Write-only (Input for external URLs)
  image_upload?: string | null; // Write-only (UUID from /api/upload/)
  image_width?: number | null; // Read-only (Display)
  image_height?: number | null; // Read-only (Display)
  answers: Answer[];
}

export interface QuestionWithQuizInfo extends Question {
  quiz_title: string;
  quiz_id: string;
}

export interface Quiz extends QuizMetadata {
  questions: Question[];
}

export interface QuizWithUserProgress extends Quiz {
  user_settings?: UserSettings;
  current_session?: QuizSession | null;
}

export interface AnswerRecord {
  id: string;
  question: string;
  answered_at: string;
  selected_answers: string[];
  was_correct: boolean;
}

export interface QuizSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  study_time: number;
  current_question: string | null;
  answers: AnswerRecord[];
}

export interface SharedQuiz {
  id: string;
  quiz: QuizMetadata;
  access_level: AccessLevel;
  user: User | null;
  group: Group | null;
  allow_edit: boolean;
}

export enum AccessLevel {
  PRIVATE = 0,
  SHARED = 1,
  UNLISTED = 2,
  PUBLIC = 3,
}
