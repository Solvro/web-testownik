const ALLOWED_QUIZ_KEYS = [
  "id",
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
  "order",
  "text",
  "explanation",
  "multiple",
  "image",
  "answers",
];

const ALLOWED_ANSWER_KEYS = ["id", "order", "text", "is_correct", "image"];

const containsOnlyAllowedKeys = (
  object: object,
  allowedKeys: string[],
): boolean => {
  return Object.keys(object).every((key) => allowedKeys.includes(key));
};

export const validateQuiz = (input: unknown): string | null => {
  if (typeof input !== "object" || input === null) {
    return "Quiz musi być obiektem.";
  }

  const quiz = input as Record<string, unknown>;

  // Check if quiz contains only allowed properties
  if (!containsOnlyAllowedKeys(quiz, ALLOWED_QUIZ_KEYS)) {
    const invalidKeys = Object.keys(quiz).filter(
      (key) => !ALLOWED_QUIZ_KEYS.includes(key),
    );
    return `Quiz zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
  }

  if (typeof quiz.title !== "string") {
    return "Tytuł quizu musi być tekstem.";
  }

  if (!quiz.title.trim()) {
    return "Podaj tytuł quizu.";
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return "Dodaj przynajmniej jedno pytanie.";
  }

  const questionIds = new Set<string>();

  for (const [questionIndex, question] of quiz.questions.entries()) {
    if (typeof question !== "object" || question === null) {
      return `Pytanie nr ${String(questionIndex + 1)} jest nieprawidłowe.`;
    }
    const q = question as Record<string, unknown>;

    // Check if question contains only allowed properties
    if (!containsOnlyAllowedKeys(q, ALLOWED_QUESTION_KEYS)) {
      const invalidKeys = Object.keys(q).filter(
        (key) => !ALLOWED_QUESTION_KEYS.includes(key),
      );
      return `Pytanie nr ${String(
        questionIndex + 1,
      )} zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
    }

    if (typeof q.text !== "string" || !q.text.trim()) {
      return `Pytanie nr ${String(questionIndex + 1)} musi mieć treść.`;
    }

    if (q.multiple !== undefined && typeof q.multiple !== "boolean") {
      return `Pytanie nr ${String(questionIndex + 1)} musi mieć prawidłowe pole "multiple" (wielokrotny wybór).`;
    }

    if (q.order !== undefined && typeof q.order !== "number") {
      return `Pytanie nr ${String(questionIndex + 1)} musi mieć prawidłową kolejność (order).`;
    }

    if (!Array.isArray(q.answers) || q.answers.length === 0) {
      return `Pytanie nr ${String(
        questionIndex + 1,
      )} musi mieć przynajmniej jedną odpowiedź.`;
    }

    if (typeof q.id !== "string") {
      return `Pytanie nr ${String(questionIndex + 1)} musi mieć prawidłowe ID.`;
    }

    if (questionIds.has(q.id)) {
      return `Pytanie nr ${String(questionIndex + 1)} ma zduplikowane ID: ${q.id}.`;
    }
    questionIds.add(q.id);

    const answerIds = new Set<string>();

    for (const [answerIndex, answer] of q.answers.entries()) {
      if (typeof answer !== "object" || answer === null) {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} jest nieprawidłowa.`;
      }
      const a = answer as Record<string, unknown>;

      if (typeof a.id !== "string") {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} musi mieć prawidłowe ID.`;
      }

      if (answerIds.has(a.id)) {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} ma zduplikowane ID: ${a.id}.`;
      }
      answerIds.add(a.id);

      // Check if answer contains only allowed properties
      if (!containsOnlyAllowedKeys(a, ALLOWED_ANSWER_KEYS)) {
        const invalidKeys = Object.keys(a).filter(
          (key) => !ALLOWED_ANSWER_KEYS.includes(key),
        );
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
      }

      if (typeof a.text !== "string" || !a.text.trim()) {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} musi mieć treść.`;
      }

      if (typeof a.is_correct !== "boolean") {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} musi mieć pole "is_correct" (poprawność).`;
      }

      if (a.order !== undefined && typeof a.order !== "number") {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} musi mieć prawidłową kolejność (order).`;
      }
    }
  }

  return null; // No validation errors
};
