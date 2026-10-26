import type { Question, QuestionType } from "./types";

/** The type fields of a question built from legacy or generated content. */
export const DEFAULT_QUESTION_TYPE_FIELDS = {
  type: "single_choice",
  shuffle_answers: true,
  open_matching: "exact",
} as const satisfies Pick<
  Question,
  "type" | "shuffle_answers" | "open_matching"
>;

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

/** Whether `value` names a question type. */
export function isQuestionType(value: unknown): value is QuestionType {
  return (
    value === "single_choice" ||
    value === "multiple_choice" ||
    value === "true_false" ||
    value === "open"
  );
}
