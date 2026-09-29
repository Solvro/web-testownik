import { quizFormSchema } from "@testownik/core/quiz/schema";

type Translate = (pl: string, en: string) => string;
const messages: Record<string, string> = {
  "Tytuł quizu jest wymagany": "Enter a quiz title.",
  "Tytuł quizu nie może przekraczać 200 znaków":
    "Keep the title within 200 characters.",
  "Quiz musi zawierać przynajmniej jedno pytanie": "Add at least one question.",
  "Pytanie musi mieć przynajmniej jedną odpowiedź": "Add at least one answer.",
  "Pytanie musi zawierać tekst lub zdjęcie": "Add question text or an image.",
  "Odpowiedź musi zawierać tekst lub zdjęcie": "Add answer text or an image.",
};

export function editorValidation(data: unknown, t: Translate) {
  const parsed = quizFormSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const question =
      issue.path[0] === "questions" && typeof issue.path[1] === "number"
        ? issue.path[1]
        : undefined;
    const answer =
      issue.path[2] === "answers" && typeof issue.path[3] === "number"
        ? issue.path[3]
        : undefined;
    const prefix =
      question === undefined
        ? ""
        : t(`Pytanie ${question + 1}`, `Question ${question + 1}`) +
          (answer === undefined
            ? ": "
            : t(`, odpowiedź ${answer + 1}: `, `, answer ${answer + 1}: `));
    return {
      question,
      message:
        prefix +
        t(
          issue.message,
          messages[issue.message] ?? "Check this field and try again.",
        ),
    };
  }
  const question = parsed.data.questions.findIndex(
    (q) => !q.answers.some((a) => a.is_correct),
  );
  if (question !== -1)
    return {
      question,
      message: t(
        `Pytanie ${question + 1}: zaznacz przynajmniej jedną poprawną odpowiedź.`,
        `Question ${question + 1}: mark at least one correct answer.`,
      ),
    };
  return null;
}
