import {AccessLevel, User} from "./ShareQuizModal/types.ts";

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

export interface Quiz extends QuizMetadata {
    questions: Question[];
}

export interface Reoccurrence {
    id: number;
    reoccurrences: number;
}