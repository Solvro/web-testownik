/**
 * Session utilities for computing quiz progress from answer history.
 */
import type { AnswerRecord, Question } from "@/types/quiz.ts";

interface ProgressSettings {
  initialReoccurrences: number;
  wrongAnswerReoccurrences: number;
}

/**
 * Compute remaining attempts for a specific question based on answer history.
 *
 * Logic:
 * - Start with initialReoccurrences
 * - Each correct answer decrements by 1
 * - Each wrong answer increments by wrongAnswerReoccurrences
 * - Minimum is 0 (question is mastered)
 */
export function getRemainingAttempts(
  questionId: string,
  answers: AnswerRecord[],
  settings: ProgressSettings,
): number {
  // Filter answers for this question, sorted by time
  const questionAnswers = answers
    .filter((a) => a.question_id === questionId)
    .toSorted(
      (a, b) =>
        new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime(),
    );

  let remaining = settings.initialReoccurrences;

  for (const answer of questionAnswers) {
    if (answer.was_correct) {
      remaining = Math.max(0, remaining - 1);
    } else {
      remaining += settings.wrongAnswerReoccurrences;
    }
  }

  return remaining;
}

/**
 * Get all remaining attempts as a map of question ID to remaining count.
 */
export function getAllRemainingAttempts(
  questions: Question[],
  answers: AnswerRecord[],
  settings: ProgressSettings,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const question of questions) {
    result.set(
      question.id,
      getRemainingAttempts(question.id, answers, settings),
    );
  }

  return result;
}

/**
 * Get questions that still need to be answered (remaining attempts > 0).
 */
export function getUnansweredQuestions(
  questions: Question[],
  answers: AnswerRecord[],
  settings: ProgressSettings,
): Question[] {
  return questions.filter(
    (q) => getRemainingAttempts(q.id, answers, settings) > 0,
  );
}

/**
 * Check if quiz is complete (all questions have 0 remaining attempts).
 */
export function isQuizComplete(
  questions: Question[],
  answers: AnswerRecord[],
  settings: ProgressSettings,
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
  settings: ProgressSettings,
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
export function pickNextQuestion(
  questions: Question[],
  answers: AnswerRecord[],
  settings: ProgressSettings,
  currentQuestionId: string | null,
): Question | null {
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
    answers: question.answers.toSorted(() => Math.random() - 0.5),
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
