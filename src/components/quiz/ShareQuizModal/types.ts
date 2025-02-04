// types.ts
import {QuizMetadata} from "../types.ts";

export enum AccessLevel {
    PRIVATE = 0,
    SHARED = 1,
    UNLISTED = 2,
    PUBLIC = 3,
}

export interface User {
    id: number;
    full_name: string;
    photo: string;
    student_number: string;
    shared_quiz_id?: string; // Optional, for deleting shared quizzes
}

export interface Term {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    finish_date: string;
    is_current: boolean;
}

export interface Group {
    id: string;
    name: string;
    term: Term;
    photo: string;
    shared_quiz_id?: string; // Optional, for deleting shared quizzes
}

export interface SharedQuiz {
    id: string;
    quiz: QuizMetadata;
    access_level: AccessLevel;
    user: User | null;
    group: Group | null;
}