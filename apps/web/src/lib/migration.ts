import {
  DEFAULT_QUESTION_TYPE_FIELDS,
  inferChoiceType,
  isQuestionType,
} from "@testownik/core/quiz/question";
import type { Answer, Question, Quiz } from "@testownik/core/quiz/types";
import { AccessLevel } from "@testownik/core/quiz/types";

import type { LegacyQuiz } from "@/types/quiz-legacy";

/** Normalize type fields from current JSON or legacy exports/local storage. */
export function normalizeQuestionTypeFields(question: {
  type?: unknown;
  shuffle_answers?: unknown;
  open_matching?: unknown;
  multiple?: unknown;
  answers: { is_correct: boolean }[];
}): Pick<Question, "type" | "shuffle_answers" | "open_matching"> {
  const type = isQuestionType(question.type)
    ? question.type
    : question.multiple === true
      ? "multiple_choice"
      : inferChoiceType(question.answers);
  return {
    ...DEFAULT_QUESTION_TYPE_FIELDS,
    type,
    shuffle_answers:
      type === "true_false"
        ? false
        : typeof question.shuffle_answers === "boolean"
          ? question.shuffle_answers
          : true,
    open_matching: question.open_matching === "similar" ? "similar" : "exact",
  };
}

/**
 * Migrates a legacy quiz object to the current Quiz format.
 * Returns both the migrated quiz and a map of legacy question IDs (numbers) to new question IDs (UUIDs).
 */
export function migrateLegacyQuiz(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  legacy: LegacyQuiz,
): { quiz: Quiz; questionIdMap: Map<number, string> } {
  const quizId =
    typeof legacy.id === "string" ? legacy.id : crypto.randomUUID();
  const questionIdMap = new Map<number, string>();

  const questions: Question[] = legacy.questions.map(
    (question, index: number) => {
      const newId = crypto.randomUUID();
      const legacyId =
        typeof question.id === "number" ? question.id : index + 1;
      questionIdMap.set(legacyId, newId);

      // Migrate answers
      const answers: Answer[] = question.answers.map((answer, answerIndex) => ({
        id: crypto.randomUUID(),
        order: answerIndex + 1,
        text: answer.answer ?? "",
        is_correct: answer.correct ?? false,
        image_url: answer.image,
      }));

      return {
        id: newId,
        order: legacyId, // Move old id to order
        text: question.question ?? "",
        explanation: question.explanation,
        ...normalizeQuestionTypeFields({ ...question, answers }),
        image_url: question.image,
        answers,
      };
    },
  );

  const quiz: Quiz = {
    id: quizId,
    title: legacy.title || "Untitled Quiz",
    description: legacy.description ?? "",
    questions,
    version: 1,
    visibility: AccessLevel.PRIVATE,
    allow_anonymous: false,
    is_anonymous: false,
    creator: null,
  };

  return { quiz, questionIdMap };
}
