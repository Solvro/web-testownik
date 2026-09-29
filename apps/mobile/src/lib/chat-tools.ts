export interface PracticeQuestion {
  text: string;
  explanation?: string;
  answers: { text: string; is_correct: boolean }[];
}
export function toolOutput(value: unknown): Record<string, unknown> | null {
  try {
    const decoded = typeof value === "string" ? JSON.parse(value) : value;
    return decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? decoded
      : null;
  } catch {
    return null;
  }
}
function practiceQuestion(value: unknown): value is PracticeQuestion {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.text === "string" &&
    !!q.text.trim() &&
    q.text.length <= 30_000 &&
    (q.explanation === undefined ||
      (typeof q.explanation === "string" && q.explanation.length <= 30_000)) &&
    Array.isArray(q.answers) &&
    q.answers.length >= 2 &&
    q.answers.length <= 6 &&
    q.answers.every((a: unknown) => {
      if (!a || typeof a !== "object") return false;
      const answer = a as Record<string, unknown>;
      return (
        typeof answer.text === "string" &&
        !!answer.text.trim() &&
        answer.text.length <= 30_000 &&
        typeof answer.is_correct === "boolean"
      );
    }) &&
    q.answers.some((a) => a.is_correct)
  );
}
export function practiceQuestions(
  output: unknown,
  single = false,
): PracticeQuestion[] | null {
  const value = toolOutput(output);
  const questions = single ? [value] : value?.questions;
  if (
    !Array.isArray(questions) ||
    !questions.length ||
    questions.length > 50 ||
    !questions.every(practiceQuestion)
  )
    return null;
  return questions;
}
export function correctPracticeAnswer(
  question: PracticeQuestion,
  selected: number[],
) {
  return question.answers.every(
    (answer, index) => answer.is_correct === selected.includes(index),
  );
}
