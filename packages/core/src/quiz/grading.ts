/**
 * Grading of a response to a question. The backend grades again with the
 * same algorithm (`quizzes/services/grading.py`); the two are kept in step
 * by the shared vectors in `grading.vectors.json`.
 */
import type { Answer, OpenMatching, Question, QuestionType } from "./types";

export type GradableQuestion = Pick<Question, "type" | "open_matching"> & {
  answers: Pick<Answer, "id" | "text" | "is_correct">[];
};

/** Whether the question is answered by picking from its answers. */
export function isChoiceType(type: QuestionType) {
  return type !== "open";
}

/** Trims, collapses whitespace and lower-cases; the exact comparison. */
export function normalizeAnswerText(text: string) {
  return text.normalize("NFC").replaceAll(/\s+/g, " ").trim().toLowerCase();
}

/**
 * The text as the similar comparison sees it: without diacritics, punctuation
 * and symbols, so that `Łódź` and `lodz` are the same.
 */
export function simplifyAnswerText(text: string) {
  return normalizeAnswerText(text)
    .replaceAll("ł", "l")
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll(/[^\p{L}\p{N} ]/gu, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/** How many typos the similar comparison forgives in an answer of `length`. */
export function typoAllowance(length: number) {
  if (length < 4) {
    return 0;
  }
  if (length <= 7) {
    return 1;
  }
  if (length <= 15) {
    return 2;
  }
  return 3;
}

/**
 * Optimal string alignment distance: the number of single-character inserts,
 * deletes, replacements and swaps of two neighbours which turn `a` into `b`.
 */
export function editDistance(a: string, b: string) {
  // Code points, like the backend's Python strings, so that a letter outside
  // the basic plane counts as one.
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const source = [...a];
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const target = [...b];
  const rows = source.length + 1;
  const columns = target.length + 1;
  const distance: number[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (__, column) =>
      row === 0 ? column : column === 0 ? row : 0,
    ),
  );
  for (let row = 1; row < rows; row++) {
    for (let column = 1; column < columns; column++) {
      const cost = source[row - 1] === target[column - 1] ? 0 : 1;
      let best = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + cost,
      );
      if (
        row > 1 &&
        column > 1 &&
        source[row - 1] === target[column - 2] &&
        source[row - 2] === target[column - 1]
      ) {
        best = Math.min(best, distance[row - 2][column - 2] + 1);
      }
      distance[row][column] = best;
    }
  }
  return distance[rows - 1][columns - 1];
}

/** Whether `typed` matches one of the `accepted` answers under `matching`. */
export function matchesOpenAnswer(
  typed: string,
  accepted: string[],
  matching: OpenMatching,
) {
  if (matching === "exact") {
    const normalized = normalizeAnswerText(typed);
    return accepted.some(
      (answer) => normalizeAnswerText(answer) === normalized,
    );
  }
  const simplified = simplifyAnswerText(typed);
  return accepted.some((answer) => {
    const expected = simplifyAnswerText(answer);
    return editDistance(simplified, expected) <= typoAllowance(expected.length);
  });
}

/** The answers a choice question counts as correct, in `answers` order. */
export function correctAnswerIds(question: GradableQuestion) {
  return question.answers
    .filter((answer) => answer.is_correct)
    .map((answer) => answer.id);
}

/** The accepted answers of an open question. */
export function acceptedAnswers(question: GradableQuestion) {
  return question.answers
    .filter((answer) => answer.is_correct)
    .map((answer) => answer.text);
}

/**
 * Whether `response` answers the question correctly. For choice types it
 * holds the selected answer IDs; for open questions the typed text, or
 * nothing when the question was skipped.
 */
export function gradeResponse(question: GradableQuestion, response: string[]) {
  if (question.type === "open") {
    const typed = response.at(0);
    return (
      response.length === 1 &&
      typed !== undefined &&
      matchesOpenAnswer(
        typed,
        acceptedAnswers(question),
        question.open_matching,
      )
    );
  }
  const selected = new Set(response);
  const correct = new Set(correctAnswerIds(question));
  return (
    selected.size === correct.size &&
    [...selected].every((id) => correct.has(id))
  );
}
