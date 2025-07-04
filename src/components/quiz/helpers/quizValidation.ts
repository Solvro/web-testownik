import { Quiz } from "../types.ts";

// Allowed keys for each object type
const ALLOWED_QUIZ_KEYS = [
  "title",
  "description",
  "visibility",
  "allow_anonymous",
  "is_anonymous",
  "version",
  "questions",
  "maintainer",
];
const ALLOWED_QUESTION_KEYS = [
  "id",
  "question",
  "explanation",
  "multiple",
  "image",
  "answers",
];
const ALLOWED_ANSWER_KEYS = ["answer", "correct", "image"];

export const validateQuiz = (quiz: Quiz): string | null => {
  // Check if quiz contains only allowed properties
  if (!containsOnlyAllowedKeys(quiz, ALLOWED_QUIZ_KEYS)) {
    const invalidKeys = Object.keys(quiz).filter(
      (key) => !ALLOWED_QUIZ_KEYS.includes(key)
    );
    return "Quiz zawiera nieprawidłowe właściwości: " + invalidKeys.join(", ");
  }

  if (!quiz.title.trim()) {
    return "Podaj tytuł quizu.";
  }

  if (quiz.questions.length === 0) {
    return "Dodaj przynajmniej jedno pytanie.";
  }

  const questionIds = new Set<number>();

  for (const [questionIndex, question] of quiz.questions.entries()) {
    // Check if question contains only allowed properties
    if (!containsOnlyAllowedKeys(question, ALLOWED_QUESTION_KEYS)) {
      const invalidKeys = Object.keys(question).filter(
        (key) => !ALLOWED_QUESTION_KEYS.includes(key)
      );
      return `Pytanie nr ${
        questionIndex + 1
      } zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
    }

    if (!question.question.trim()) {
      return `Pytanie nr ${questionIndex + 1} musi mieć treść.`;
    }

    if (question.answers.length < 1) {
      return `Pytanie nr ${
        questionIndex + 1
      } musi mieć przynajmniej jedną odpowiedź.`;
    }

    if (questionIds.has(question.id)) {
      return `Pytanie nr ${questionIndex + 1} ma zduplikowane ID: ${
        question.id
      }.`;
    }
    questionIds.add(question.id);

    for (const [answerIndex, answer] of question.answers.entries()) {
      // Check if answer contains only allowed properties
      if (!containsOnlyAllowedKeys(answer, ALLOWED_ANSWER_KEYS)) {
        const invalidKeys = Object.keys(answer).filter(
          (key) => !ALLOWED_ANSWER_KEYS.includes(key)
        );
        return `Odpowiedź nr ${answerIndex + 1} w pytaniu nr ${
          questionIndex + 1
        } zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
      }

      if (!answer.answer.trim()) {
        return `Odpowiedź nr ${answerIndex + 1} w pytaniu nr ${
          questionIndex + 1
        } musi mieć treść.`;
      }
    }
  }

  return null; // No validation errors
};

// Utility function to check if an object contains only allowed keys
const containsOnlyAllowedKeys = <T extends object>(
  obj: T,
  allowedKeys: string[]
): boolean => {
  return Object.keys(obj as object).every((key) => allowedKeys.includes(key));
};
