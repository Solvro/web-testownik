import * as z from "zod";

export const answerFormSchema = z.object({
  id: z.string(),
  order: z.number(),
  text: z.string().min(1, "Tekst odpowiedzi nie może być pusty"),
  is_correct: z.boolean(),
  image_url: z.string().optional().nullable(),
  image_upload: z.string().optional().nullable(),
  image_width: z.number().optional().nullable().readonly(),
  image_height: z.number().optional().nullable().readonly(),
});

export const questionFormSchema = z.object({
  id: z.string(),
  order: z.number(),
  text: z.string().min(1, "Tekst pytania nie może być pusty"),
  explanation: z.string(),
  multiple: z.boolean(),
  image_url: z.string().optional().nullable(),
  image_upload: z.string().optional().nullable(),
  image_width: z.number().optional().nullable().readonly(),
  image_height: z.number().optional().nullable().readonly(),
  answers: z
    .array(answerFormSchema)
    .min(1, { error: "Pytanie musi mieć przynajmniej jedną odpowiedź" }),
});

export const quizFormSchema = z.object({
  title: z
    .string()
    .min(1, { error: "Tytuł quizu jest wymagany" })
    .max(200, { error: "Tytuł quizu nie może przekraczać 200 znaków" }),
  description: z.string(),
  questions: z
    .array(questionFormSchema)
    .min(1, { error: "Quiz musi zawierać przynajmniej jedno pytanie" }),
});

export type AnswerFormData = z.infer<typeof answerFormSchema>;
export type QuestionFormData = z.infer<typeof questionFormSchema>;
export type QuizFormData = z.infer<typeof quizFormSchema>;

export function validateQuizForm(
  data: unknown,
): { success: true; data: QuizFormData } | { success: false; error: string } {
  const result = quizFormSchema.safeParse(data);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path;
    let errorMessage = firstIssue.message;

    if (path.length > 0) {
      const parts: string[] = [];

      const questionIndex = path.indexOf("questions");
      if (questionIndex !== -1 && path.length > questionIndex + 1) {
        const index = path[questionIndex + 1];
        if (typeof index === "number") {
          parts.push(`Pytanie ${String(index + 1)}`);
        }
      }

      const answerIndex = path.indexOf("answers");
      if (answerIndex !== -1 && path.length > answerIndex + 1) {
        const index = path[answerIndex + 1];
        if (typeof index === "number") {
          parts.push(`Odpowiedź ${String(index + 1)}`);
        }
      }

      if (parts.length > 0) {
        errorMessage = `${parts.join(", ")}: ${errorMessage}`;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }

  return { success: true, data: result.data };
}
