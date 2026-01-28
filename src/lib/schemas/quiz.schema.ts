import * as z from "zod";

export const answerFormSchema = z
  .object({
    id: z.string(),
    order: z.number(),
    text: z.string(),
    is_correct: z.boolean(),
    image: z.string().optional().nullable().readonly(), // Read-only (Display URL from backend)
    image_url: z.string().optional().nullable(), // Write-only (Input for external URLs)
    image_upload: z.string().optional().nullable(), // Write-only (UUID from /api/upload/)
    image_width: z.number().optional().nullable().readonly(),
    image_height: z.number().optional().nullable().readonly(),
  })
  .refine(
    (data) => {
      const hasText = data.text.trim().length > 0;
      const hasImage =
        (data.image !== null &&
          data.image !== undefined &&
          data.image !== "") ||
        (data.image_url !== null &&
          data.image_url !== undefined &&
          data.image_url !== "") ||
        (data.image_upload != null && data.image_upload !== "");
      return hasText || hasImage;
    },
    {
      error: "Odpowiedź musi zawierać tekst lub zdjęcie",
    },
  );

export const questionFormSchema = z
  .object({
    id: z.string(),
    order: z.number(),
    text: z.string(),
    explanation: z.string(),
    multiple: z.boolean(),
    image: z.string().optional().nullable().readonly(), // Read-only (Display URL from backend)
    image_url: z.string().optional().nullable(), // Write-only (Input for external URLs)
    image_upload: z.string().optional().nullable(), // Write-only (UUID from /api/upload/)
    image_width: z.number().optional().nullable().readonly(),
    image_height: z.number().optional().nullable().readonly(),
    answers: z
      .array(answerFormSchema)
      .min(1, { error: "Pytanie musi mieć przynajmniej jedną odpowiedź" }),
  })
  .refine(
    (data) => {
      const hasText = data.text.trim().length > 0;
      const hasImage =
        (data.image !== null &&
          data.image !== undefined &&
          data.image !== "") ||
        (data.image_url !== null &&
          data.image_url !== undefined &&
          data.image_url !== "") ||
        (data.image_upload != null && data.image_upload !== "");
      return hasText || hasImage;
    },
    {
      error: "Pytanie musi zawierać tekst lub zdjęcie",
    },
  );

export const quizFormSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Tytuł quizu jest wymagany" })
    .max(200, { message: "Tytuł quizu nie może przekraczać 200 znaków" }),
  description: z.string(),
  questions: z
    .array(questionFormSchema)
    .min(1, { message: "Quiz musi zawierać przynajmniej jedno pytanie" }),
});

export type AnswerFormData = z.infer<typeof answerFormSchema>;
export type QuestionFormData = z.infer<typeof questionFormSchema>;
export type QuizFormData = z.infer<typeof quizFormSchema>;

export type ValidationResult =
  | { success: true; data: QuizFormData }
  | { success: false; error: string; path?: (string | number)[] };

export function validateQuizForm(data: unknown): ValidationResult {
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
      path: path as (string | number)[],
    };
  }

  return { success: true, data: result.data };
}

/**
 * Prepare answer data for submission to the backend.
 * Removes the read-only fields (image, image_width, image_height) and ensures mutual exclusivity of `image_url` and `image_upload`.
 */
function prepareAnswerForSubmission(answer: AnswerFormData) {
  const { image, image_width, image_height, ...rest } = answer;

  if (
    rest.image_upload !== null &&
    rest.image_upload !== undefined &&
    rest.image_upload !== ""
  ) {
    return {
      ...rest,
      image_url: null,
    };
  }

  if (
    rest.image_url !== null &&
    rest.image_url !== undefined &&
    rest.image_url !== ""
  ) {
    return {
      ...rest,
      image_upload: null,
    };
  }

  return rest;
}

/**
 * Prepare question data for submission to the backend.
 * Removes the read-only fields (image, image_width, image_height) and ensures mutual exclusivity of `image_url` and `image_upload`.
 */
function prepareQuestionForSubmission(question: QuestionFormData) {
  const { image, image_width, image_height, answers, ...rest } = question;

  const preparedQuestion = {
    ...rest,
    answers: answers.map((a) => prepareAnswerForSubmission(a)),
  };

  if (
    preparedQuestion.image_upload !== null &&
    preparedQuestion.image_upload !== undefined &&
    preparedQuestion.image_upload !== ""
  ) {
    return {
      ...preparedQuestion,
      image_url: null,
    };
  }

  if (
    preparedQuestion.image_url !== null &&
    preparedQuestion.image_url !== undefined &&
    preparedQuestion.image_url !== ""
  ) {
    return {
      ...preparedQuestion,
      image_upload: null,
    };
  }

  return preparedQuestion;
}

/**
 * Prepare quiz form data for submission to the backend.
 * - Removes read-only fields (image, image_width, image_height)
 * - Ensures mutual exclusivity of image_url and image_upload
 */
export function prepareQuizForSubmission(data: QuizFormData) {
  return {
    title: data.title,
    description: data.description,
    questions: data.questions.map((q) => prepareQuestionForSubmission(q)),
  };
}
