import type { Question } from "@/types/quiz";

const MAX_ID_LENGTH = 100;
const MAX_QUESTION_TEXT_LENGTH = 50_000;
const MAX_ANSWER_TEXT_LENGTH = 20_000;
const MAX_EXPLANATION_LENGTH = 50_000;
const MAX_IMAGE_URL_LENGTH = 4096;
const MAX_ANSWERS = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isOptionalBoundedString(value: unknown, maximum: number): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= maximum)
  );
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isQuestion(value: unknown): value is Question {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const question = value as Record<string, unknown>;
  return (
    typeof question.id === "string" &&
    question.id.length <= MAX_ID_LENGTH &&
    typeof question.order === "number" &&
    Number.isInteger(question.order) &&
    typeof question.text === "string" &&
    question.text.length <= MAX_QUESTION_TEXT_LENGTH &&
    isOptionalBoundedString(question.explanation, MAX_EXPLANATION_LENGTH) &&
    isOptionalBoundedString(question.image, MAX_IMAGE_URL_LENGTH) &&
    typeof question.multiple === "boolean" &&
    Array.isArray(question.answers) &&
    question.answers.length <= MAX_ANSWERS &&
    question.answers.every((answer: unknown) => {
      if (typeof answer !== "object" || answer === null) {
        return false;
      }
      const candidate = answer as Record<string, unknown>;
      return (
        typeof candidate.text === "string" &&
        candidate.text.length <= MAX_ANSWER_TEXT_LENGTH &&
        isOptionalBoundedString(candidate.image, MAX_IMAGE_URL_LENGTH) &&
        typeof candidate.is_correct === "boolean"
      );
    })
  );
}

export function estimateJsonTokens(value: unknown) {
  return Math.ceil(JSON.stringify(value).length / 4);
}
