import type {
  AnswerFormData,
  QuestionFormData,
} from "@testownik/core/quiz/schema";
import { TRUE_FALSE_LABELS } from "@testownik/core/quiz/types";
import type { QuestionType } from "@testownik/core/quiz/types";

export function createAnswer(
  order: number,
  text = "",
  isCorrect = false,
): AnswerFormData {
  return {
    id: crypto.randomUUID(),
    order,
    text,
    is_correct: isCorrect,
    image: null,
    image_url: null,
    image_upload: null,
    image_width: null,
    image_height: null,
  };
}

/** The two fixed answers of a true/false question, "true" first. */
export function createTrueFalseAnswers(): AnswerFormData[] {
  return [
    createAnswer(1, TRUE_FALSE_LABELS[0], true),
    createAnswer(2, TRUE_FALSE_LABELS[1]),
  ];
}

export function createQuestion(
  order: number,
  type: QuestionType = "single_choice",
): QuestionFormData {
  return {
    id: crypto.randomUUID(),
    order,
    text: "",
    type,
    shuffle_answers: type !== "true_false",
    open_matching: "exact",
    is_markdown_enabled: true,
    answers:
      type === "true_false"
        ? createTrueFalseAnswers()
        : type === "open"
          ? [createAnswer(1, "", true)]
          : [createAnswer(1), createAnswer(2)],
    image: null,
    image_url: null,
    image_upload: null,
    explanation: "",
  };
}
