const ALLOWED_LEGACY_QUIZ_KEYS = [
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

const ALLOWED_LEGACY_QUESTION_KEYS = [
  "id",
  "question",
  "explanation",
  "multiple",
  "image",
  "answers",
];

const ALLOWED_LEGACY_ANSWER_KEYS = ["answer", "correct", "image"];

const containsOnlyAllowedKeys = (
  object: object,
  allowedKeys: string[],
): boolean => {
  return Object.keys(object).every((key) => allowedKeys.includes(key));
};

export const validateLegacyQuiz = (input: unknown): string | null => {
  if (typeof input !== "object" || input === null) {
    return "Quiz musi być obiektem.";
  }

  const quiz = input as Record<string, unknown>;

  // Check if quiz contains only allowed properties
  if (!containsOnlyAllowedKeys(quiz, ALLOWED_LEGACY_QUIZ_KEYS)) {
    const invalidKeys = Object.keys(quiz).filter(
      (key) => !ALLOWED_LEGACY_QUIZ_KEYS.includes(key),
    );
    return `Quiz zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
  }

  if (typeof quiz.title !== "string" || quiz.title.trim() === "") {
    return "Podaj tytuł quizu.";
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return "Dodaj przynajmniej jedno pytanie.";
  }

  const questionIds = new Set<string | number>();

  for (const [questionIndex, question] of quiz.questions.entries()) {
    if (typeof question !== "object" || question === null) {
      return `Pytanie nr ${String(questionIndex + 1)} jest nieprawidłowe.`;
    }
    const q = question as Record<string, unknown>;

    // Check if question contains only allowed properties
    if (!containsOnlyAllowedKeys(q, ALLOWED_LEGACY_QUESTION_KEYS)) {
      const invalidKeys = Object.keys(q).filter(
        (key) => !ALLOWED_LEGACY_QUESTION_KEYS.includes(key),
      );
      return `Pytanie nr ${String(
        questionIndex + 1,
      )} zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
    }

    if (typeof q.question === "string" && q.question.trim() === "") {
      return `Pytanie nr ${String(questionIndex + 1)} musi mieć treść.`;
    }
    // Handle case where question might be missing/undefined if implied optional in legacy?
    // Based on original code: (question.question?.trim() ?? "") === "" check suggests it could be missing.
    // If it's missing (undefined), logic: (undefined?.trim() ?? "") === "" -> "" === "" -> true -> error.
    // So if it's missing or empty string it errors.
    if (typeof q.question !== "string" || q.question.trim() === "") {
      return `Pytanie nr ${String(questionIndex + 1)} musi mieć treść.`;
    }

    if (!Array.isArray(q.answers) || q.answers.length === 0) {
      return `Pytanie nr ${String(
        questionIndex + 1,
      )} musi mieć przynajmniej jedną odpowiedź.`;
    }

    if (
      q.id !== undefined &&
      typeof q.id !== "string" &&
      typeof q.id !== "number"
    ) {
      // ID is optional but if present must be string or number
      return `Pytanie nr ${String(questionIndex + 1)} ma nieprawidłowe ID.`;
    }

    if (q.id !== undefined && questionIds.has(q.id)) {
      return `Pytanie nr ${String(questionIndex + 1)} ma zduplikowane ID: ${String(q.id)}.`;
    }
    if (q.id !== undefined) {
      questionIds.add(q.id);
    }

    for (const [answerIndex, answer] of q.answers.entries()) {
      if (typeof answer !== "object" || answer === null) {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} jest nieprawidłowa.`;
      }
      const a = answer as Record<string, unknown>;

      // Check if answer contains only allowed properties
      if (!containsOnlyAllowedKeys(a, ALLOWED_LEGACY_ANSWER_KEYS)) {
        const invalidKeys = Object.keys(a).filter(
          (key) => !ALLOWED_LEGACY_ANSWER_KEYS.includes(key),
        );
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} zawiera nieprawidłowe właściwości: ${invalidKeys.join(", ")}`;
      }

      // Original logic: (answer.answer?.trim() ?? "") === ""
      if (typeof a.answer !== "string" || a.answer.trim() === "") {
        return `Odpowiedź nr ${String(answerIndex + 1)} w pytaniu nr ${String(
          questionIndex + 1,
        )} musi mieć treść.`;
      }
    }
  }

  return null; // No validation errors
};
