/**
 * Session utilities for computing quiz progress from answer history.
 */
import { DEFAULT_USER_SETTINGS } from "../user/types";
import type { UserSettings } from "../user/types";
import { gradeResponse } from "./grading";
import { getDeterministicShuffle } from "./shuffle";
import type {
  AnswerRecord,
  Question,
  QuizSession,
  QuizWithUserProgress,
} from "./types";

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
    .sort(
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
  if (
    settings.max_question_reoccurrences !== null &&
    answeredCount >= settings.max_question_reoccurrences
  ) {
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
 * Get how many times a question has appeared / been interacted with.
 *
 * Semantics:
 * - When `questionChecked` is `true`, this returns the number of stored
 *   answers for the given question (i.e. how many times it was actually
 *   answered, correct or not).
 * - When `questionChecked` is `false`, this additionally counts the current,
 *   not-yet-checked attempt as one more appearance (i.e. "times shown",
 *   including the current attempt).
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

function getQuestionAppearanceNumber(
  questionId: string,
  answers: AnswerRecord[],
  questionChecked: boolean,
): number {
  return Math.max(
    1,
    getQuestionAnsweredCount(questionId, questionChecked, answers),
  );
}

function getAnswerShuffleSeed(
  seed: string | undefined,
  questionId: string,
  appearanceNumber: number,
): string {
  return `${seed ?? "question"}-${questionId}-${appearanceNumber.toString()}`;
}

/**
 * Whether the answers show in a random order. True/false keeps its "true"
 * label first; an open question has nothing to shuffle.
 */
export function shufflesAnswers(
  question: Pick<Question, "type" | "shuffle_answers">,
) {
  return (
    question.shuffle_answers &&
    question.type !== "true_false" &&
    question.type !== "open"
  );
}

/** The answers in the order shown for the given appearance of the question. */
function orderAnswers(question: Question, seed: string): Question {
  return {
    ...question,
    answers: shufflesAnswers(question)
      ? getDeterministicShuffle(question.answers, seed)
      : question.answers.toSorted((a, b) => a.order - b.order),
  };
}

export function getQuestionWithShuffledAnswers(
  question: Question,
  answers: AnswerRecord[],
  seed?: string,
  questionChecked = false,
): Question {
  return orderAnswers(
    question,
    getAnswerShuffleSeed(
      seed,
      question.id,
      getQuestionAppearanceNumber(question.id, answers, questionChecked),
    ),
  );
}

export function getAnsweredQuestionWithShuffledAnswers(
  question: Question,
  answers: AnswerRecord[],
  seed?: string,
): Question {
  const appearanceNumber = Math.max(
    1,
    answers.filter((answer) => answer.question === question.id).length,
  );

  return orderAnswers(
    question,
    getAnswerShuffleSeed(seed, question.id, appearanceNumber),
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

  return getQuestionWithShuffledAnswers(question, answers, seed);
}

/**
 * Whether the response answers the question correctly: the selected answer
 * IDs of a choice question, or the typed text of an open one.
 */
export function checkAnswerCorrectness(
  question: Question,
  selectedAnswers: string[],
): boolean {
  return gradeResponse(question, selectedAnswers);
}

export function createAnswerRecord(
  questionId: string,
  selectedAnswers: string[],
  wasCorrect: boolean,
  // Native callers supply an Expo UUID; browser callers use Web Crypto.
  id: string = crypto.randomUUID(),
): AnswerRecord {
  return {
    id,
    question: questionId,
    answered_at: new Date().toISOString(),
    selected_answers: selectedAnswers,
    was_correct: wasCorrect,
  };
}

/**
 * The record of a flashcard the learner graded themselves: no response, only
 * whether they knew it. Counts like any other answer towards the progress.
 */
export function createSelfAssessmentRecord(
  questionId: string,
  knew: boolean,
  id?: string,
): AnswerRecord {
  return createAnswerRecord(questionId, [], knew, id);
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
  questionChecked = false,
): Question | null {
  const session = quiz.current_session;
  const answers = session?.answers ?? [];

  if (session?.current_question != null) {
    const savedQuestion = quiz.questions.find(
      (q) => q.id === session.current_question,
    );
    if (savedQuestion !== undefined) {
      return getQuestionWithShuffledAnswers(
        savedQuestion,
        answers,
        session.id,
        questionChecked,
      );
    }
  }

  return pickNextQuestion({
    questions: quiz.questions,
    answers,
    settings,
    seed: session?.id,
  });
}

export function ensureQuizCurrentQuestion(
  quiz: QuizWithUserProgress,
  settings: UserSettings,
): QuizWithUserProgress {
  const session = quiz.current_session;

  if (session == null) {
    return {
      ...quiz,
      current_session: buildFallbackSession(quiz, settings),
    };
  }

  if (
    session.current_question !== null ||
    isQuizComplete(quiz.questions, session.answers, settings)
  ) {
    return quiz;
  }

  const currentQuestion = pickNextQuestion({
    questions: quiz.questions,
    answers: session.answers,
    settings,
    seed: session.id,
  });

  return {
    ...quiz,
    current_session: {
      ...session,
      current_question: currentQuestion?.id ?? null,
    },
  };
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
