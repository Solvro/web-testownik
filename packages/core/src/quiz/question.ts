import type { Question, QuestionType } from "./types";

/** The type fields of a question built from legacy or generated content. */
export const DEFAULT_QUESTION_TYPE_FIELDS = {
  type: "single_choice",
  open_matching: "exact",
} as const satisfies Pick<Question, "type" | "open_matching">;

/**
 * The choice type implied by the correct answers: multiple choice when more
 * than one is correct. For content without an explicit type, such as legacy
 * files and AI output.
 */
export function inferChoiceType(
  answers: { is_correct: boolean }[],
): QuestionType {
  return answers.filter((answer) => answer.is_correct).length > 1
    ? "multiple_choice"
    : "single_choice";
}

/**
 * The type of a question after its answers were replaced, as by an AI edit:
 * the type stays, except that single choice becomes multiple choice when
 * several answers are correct, which it could not hold.
 */
export function typeAfterAnswerEdit(
  type: QuestionType,
  answers: { is_correct: boolean }[],
): QuestionType {
  return type === "single_choice" &&
    answers.filter((answer) => answer.is_correct).length > 1
    ? "multiple_choice"
    : type;
}

/** Whether `value` names a question type. */
export function isQuestionType(value: unknown): value is QuestionType {
  return (
    value === "single_choice" ||
    value === "multiple_choice" ||
    value === "true_false" ||
    value === "open"
  );
}
