import type { Group, User } from "./user.ts";

export interface QuizMetadata {
  id: string;
  title: string;
  description: string;
  maintainer?: User;
  visibility: AccessLevel;
  allow_anonymous: boolean;
  is_anonymous: boolean;
  version: number;
  can_edit?: boolean;
}

export interface Answer {
  answer: string;
  correct: boolean;
  image?: string; // URL to image
}

export interface Question {
  id: number;
  question: string;
  explanation?: string;
  multiple: boolean; // Single or multiple choice
  image?: string; // URL to image
  answers: Answer[];
}

export interface QuestionWithQuizInfo extends Question {
  quiz_title: string;
  quiz_id: string;
}

export interface Quiz extends QuizMetadata {
  questions: Question[];
}

export interface Reoccurrence {
  id: number;
  reoccurrences: number;
}

export interface QuizProgress {
  current_question: number;
  correct_answers_count: number;
  wrong_answers_count: number;
  study_time: number;
  last_activity?: string;
  reoccurrences: Reoccurrence[];
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
