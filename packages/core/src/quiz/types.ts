import type { Group, User, UserSettings } from "../user/types";

export interface QuizBase {
  id: string;
  title: string;
  description: string;
  creator?: User | null;
  visibility: AccessLevel;
  allow_anonymous: boolean;
  is_anonymous: boolean;
  version: number;
  can_edit?: boolean;
}

export interface QuizMetadata extends QuizBase {
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
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

/**
 * How a question is answered. Choice types pick from `answers`; `open` is
 * typed and compared with the accepted answers in `answers`.
 */
export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "open",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/** How a typed answer to an open question is compared with the accepted ones. */
export const OPEN_MATCHINGS = ["exact", "similar"] as const;

export type OpenMatching = (typeof OPEN_MATCHINGS)[number];

export interface Question {
  id: string;
  order: number;
  text: string;
  explanation?: string;
  type: QuestionType;
  /** Only read for open questions. */
  open_matching: OpenMatching;
  is_ai_generated?: boolean;
  /** Whether the text, answers and explanation render as Markdown. Defaults to true. */
  is_markdown_enabled?: boolean;
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

export interface Quiz extends QuizBase {
  questions: Question[];
  has_external_images?: boolean;
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

export type QuizVersionSource =
  | "baseline"
  | "create"
  | "copy"
  | "editor"
  | "question"
  | "ai"
  | "mcp"
  | "restore";

/** Changes compared with the previous version; zero counts are omitted. */
export interface QuizVersionSummary {
  created?: boolean;
  added?: number;
  removed?: number;
  changed?: number;
  reordered?: boolean;
  title?: boolean;
  description?: boolean;
}

/** A version of a quiz's content, from its version history. */
export interface QuizVersion {
  version: number;
  created_at: string;
  /** The last change merged into this version. */
  updated_at: string;
  author: User | null;
  source: QuizVersionSource;
  restored_from: number | null;
  title: string;
  question_count: number;
  summary: QuizVersionSummary;
}

export interface QuizVersionAnswer {
  id: string;
  order: number;
  text: string;
  is_correct: boolean;
  image: string | null;
}

export interface QuizVersionQuestion {
  id: string;
  order: number;
  text: string;
  explanation: string;
  type: QuestionType;
  open_matching: OpenMatching;
  is_markdown_enabled?: boolean;
  image: string | null;
  answers: QuizVersionAnswer[];
}

export interface QuizVersionDetail extends QuizVersion {
  content: {
    title: string;
    description: string;
    questions: QuizVersionQuestion[];
  };
}
