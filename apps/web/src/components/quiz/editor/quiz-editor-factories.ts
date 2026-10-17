import type {
  AnswerFormData,
  QuestionFormData,
} from "@testownik/core/quiz/schema";

export function createAnswer(order: number): AnswerFormData {
  return {
    id: crypto.randomUUID(),
    order,
    text: "",
    is_correct: false,
    image: null,
    image_url: null,
    image_upload: null,
    image_width: null,
    image_height: null,
  };
}

export function createQuestion(
  order: number,
  multiple = false,
): QuestionFormData {
  return {
    id: crypto.randomUUID(),
    order,
    text: "",
    multiple,
    is_markdown_enabled: true,
    answers: [createAnswer(1), createAnswer(2)],
    image: null,
    image_url: null,
    image_upload: null,
    explanation: "",
  };
}
