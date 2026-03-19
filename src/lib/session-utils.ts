/**
 * Session utilities for computing quiz progress from answer history.
 */
import type {
  AnswerRecord,
  Question,
  QuizSession,
  QuizWithUserProgress,
} from "@/types/quiz";
import { DEFAULT_USER_SETTINGS } from "@/types/user";
import type { UserSettings } from "@/types/user";

import { getDeterministicShuffle } from "./shuffle-utils";

/**
 * Compute remaining attempts for a specific question based on answer history.
 *
 * Logic:
 * - Start with initial_reoccurrences
 * - Each correct answer decrements by 1
 * - Each wrong answer increments by wrong_answer_reoccurrences
 * - Minimum is 0 (question is mastered)
 */
export function getRemainingAttempts(
  questionId: string,
  answers: AnswerRecord[],
  settings: UserSettings,
): number {
  // Filter answers for this question, sorted by time
  const questionAnswers = answers
    .filter((a) => a.question === questionId)
    .toSorted(
      (a, b) =>
        new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime(),
    );

  let remaining = settings.initial_reoccurrences;

  const answeredCount = getQuestionAnsweredCount(
    questionId,
    true,
    questionAnswers,
  );

  // Reached max question reoccurrences
  if (answeredCount >= settings.max_question_reoccurrences) {
    remaining = 0;
    return remaining;
  }

  for (const answer of questionAnswers) {
    if (answer.was_correct) {
      remaining = Math.max(0, remaining - 1);
    } else {
      remaining += settings.wrong_answer_reoccurrences;
    }
  }

  return remaining;
}

/**
 * Get questions that still need to be answered (remaining attempts > 0).
 */
export function getUnansweredQuestions(
  questions: Question[],
  answers: AnswerRecord[],
  settings: UserSettings,
): Question[] {
  return questions.filter(
    (q) => getRemainingAttempts(q.id, answers, settings) > 0,
  );
}

/**
 * Get how many times question was answered (correct or not)
 */
export function getQuestionAnsweredCount(
  questionId: string,
  questionChecked: boolean,
  answers: AnswerRecord[],
): number {
  return answers.reduce(
    (count, answer) => (answer.question === questionId ? count + 1 : count),
    questionChecked ? 0 : 1,
  );
}

/**
 * Check if quiz is complete (all questions have 0 remaining attempts).
 */
export function isQuizComplete(
  questions: Question[],
  answers: AnswerRecord[],
  settings: UserSettings,
): boolean {
  return questions.every(
    (q) => getRemainingAttempts(q.id, answers, settings) === 0,
  );
}

/**
 * Count questions that are mastered (0 remaining attempts).
 */
export function getMasteredCount(
  questions: Question[],
  answers: AnswerRecord[],
  settings: UserSettings,
): number {
  return questions.filter(
    (q) => getRemainingAttempts(q.id, answers, settings) === 0,
  ).length;
}

/**
 * Get total correct and wrong counts from answer history.
 */
export function getAnswerCounts(answers: AnswerRecord[]): {
  correct: number;
  wrong: number;
} {
  return {
    correct: answers.filter((a) => a.was_correct).length,
    wrong: answers.filter((a) => !a.was_correct).length,
  };
}

/**
 * Pick the next question to show based on remaining attempts.
 *
 * Strategy: Pick a random question from those with remaining attempts > 0,
 * avoiding the current question if possible.
 */
export function pickNextQuestion({
  questions,
  answers,
  settings,
  currentQuestionId,
  seed,
}: {
  questions: Question[];
  answers: AnswerRecord[];
  settings: UserSettings;
  currentQuestionId?: string | null;
  seed?: string;
}): Question | null {
  const unanswered = getUnansweredQuestions(questions, answers, settings);

  if (unanswered.length === 0) {
    return null; // Quiz complete
  }

  const notCurrent = unanswered.filter((q) => q.id !== currentQuestionId);
  const candidates = notCurrent.length > 0 ? notCurrent : unanswered;

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const question = candidates[randomIndex];

  return {
    ...question,
    answers: getDeterministicShuffle(question.answers, seed ?? question.id),
  };
}

/**
 * Determine if answer is correct by comparing selected answers with correct answers.
 */
export function checkAnswerCorrectness(
  question: Question,
  selectedAnswers: string[],
): boolean {
  const correctAnswerIds = question.answers
    .filter((a) => a.is_correct)
    .map((a) => a.id);

  const selectedSet = new Set(selectedAnswers);
  const correctSet = new Set(correctAnswerIds);

  return (
    selectedSet.size === correctSet.size &&
    [...selectedSet].every((id) => correctSet.has(id))
  );
}

export function createAnswerRecord(
  questionId: string,
  selectedAnswers: string[],
  wasCorrect: boolean,
): AnswerRecord {
  return {
    id: crypto.randomUUID(),
    question: questionId,
    answered_at: new Date().toISOString(),
    selected_answers: selectedAnswers,
    was_correct: wasCorrect,
  };
}

export function deriveSettings(
  userSettings?: UserSettings | null,
): UserSettings {
  return {
    ...DEFAULT_USER_SETTINGS,
    ...userSettings,
  };
}

export function resolveCurrentQuestion(
  quiz: QuizWithUserProgress,
  settings: UserSettings,
): Question | null {
  const session = quiz.current_session;
  const answers = session?.answers ?? [];

  if (session?.current_question != null) {
    const savedQuestion = quiz.questions.find(
      (q) => q.id === session.current_question,
    );
    if (savedQuestion !== undefined) {
      const seed = `${session.id}-${String(session.study_time)}`;
      return {
        ...savedQuestion,
        answers: getDeterministicShuffle(savedQuestion.answers, seed),
      };
    }
  }

  return pickNextQuestion({
    questions: quiz.questions,
    answers,
    settings,
    seed:
      session == null
        ? undefined
        : `${session.id}-${String(session.study_time)}`,
  });
}

export function buildFallbackSession(
  quiz: QuizWithUserProgress,
  settings: UserSettings,
): QuizSession {
  const firstQuestion = pickNextQuestion({
    questions: quiz.questions,
    answers: [],
    settings,
    currentQuestionId: null,
  });

  return {
    id: crypto.randomUUID(),
    started_at: new Date().toISOString(),
    ended_at: null,
    is_active: true,
    study_time: 0,
    current_question: firstQuestion?.id ?? null,
    answers: [],
  };
}
