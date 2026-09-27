/**
 * @deprecated Use Answer instead for current quizzes
 */
export interface LegacyAnswer {
  answer?: string;
  correct?: boolean;
  image?: string;
}

/**
 * @deprecated Use Question instead for current quizzes
 */
export interface LegacyQuestion {
  id?: number;
  question?: string;
  explanation?: string;
  multiple: boolean;
  image?: string;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  answers: LegacyAnswer[];
}

/**
 * @deprecated Use Quiz instead for current quizzes
 */
export interface LegacyQuiz {
  id?: string;
  title: string;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  questions: LegacyQuestion[];
}

/**
 * @deprecated Use AnswerRecord instead
 */
export interface Reoccurrence {
  id: number;
  reoccurrences: number;
}

/**
 * @deprecated Use QuizSession instead
 */
export interface QuizProgress {
  current_question: number;
  correct_answers_count: number;
  wrong_answers_count: number;
  study_time: number;
  last_activity?: string;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  reoccurrences: Reoccurrence[];
}
