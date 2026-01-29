import type { Answer, Question, Quiz } from "@/types/quiz";

const pickAnswerFields = (answer: Answer) => ({
  id: answer.id,
  order: answer.order,
  text: answer.text,
  is_correct: answer.is_correct,
  image_url: answer.image ?? undefined,
});

const pickQuestionFields = (question: Question) => ({
  id: question.id,
  order: question.order,
  text: question.text,
  explanation: question.explanation || undefined,
  multiple: question.multiple,
  image_url: question.image ?? undefined,
  answers: question.answers.map((a) => pickAnswerFields(a)),
});

export function prepareQuizForDownload(quiz: Quiz) {
  return {
    comment: quiz.questions.some(
      (q) =>
        q.image_upload !== null ||
        q.answers.some((a) => a.image_upload !== null),
    )
      ? "Ten quiz zawiera pytania ze zdjęciami. Po pobraniu quizu linki do zdjęć będą aktywne przez co najmniej 24 godziny. Po tym czasie linki mogą przestać działać."
      : undefined,
    title: quiz.title,
    description: quiz.description,
    version: quiz.version,
    questions: quiz.questions.map((q) => pickQuestionFields(q)),
  };
}
