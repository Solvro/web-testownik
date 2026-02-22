import { toast } from "sonner";

import type { QuestionFormData } from "@/lib/schemas/quiz.schema";

export function formatValidationError(
  path: (string | number | symbol)[],
  defaultMessage: string,
): string {
  if (path.length === 0) {
    return defaultMessage;
  }

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
    return `${parts.join(", ")}: ${defaultMessage}`;
  }

  return defaultMessage;
}

export const handleValidationFailure = (
  validation: {
    success: false;
    error: string;
    path?: (string | number | symbol)[];
  },
  context: {
    questions?: QuestionFormData[];
    singleQuestion?: QuestionFormData;
  },
) => {
  let scrollToId: string | null = null;
  const path = validation.path;

  if (Array.isArray(path) && path.length > 0) {
    if (context.questions !== undefined) {
      // Quiz context
      const questionIndex = path.indexOf("questions");
      if (questionIndex !== -1) {
        const rawQIndex = path[questionIndex + 1];
        if (typeof rawQIndex === "number") {
          const question = context.questions[rawQIndex];
          scrollToId = `question-${question.id}`;
          const answerIndex = path.indexOf("answers");
          if (answerIndex !== -1) {
            const rawAIndex = path[answerIndex + 1];
            if (typeof rawAIndex === "number") {
              const answer = question.answers[rawAIndex];
              scrollToId = `answer-${answer.id}`;
            }
          }
        }
      }
    } else if (context.singleQuestion !== undefined) {
      // Single question context (QuickEdit)
      const answerIndex = path.indexOf("answers");
      if (answerIndex !== -1 && path.length > answerIndex + 1) {
        const index = path[answerIndex + 1];
        if (typeof index === "number") {
          const answer = context.singleQuestion.answers[index];
          scrollToId = `answer-${answer.id}`;
        }
      }
    }
  }

  toast.error(validation.error, {
    action:
      scrollToId === null
        ? undefined
        : {
            label: "Pokaż",
            onClick: () => {
              setTimeout(() => {
                const element = document.querySelector<HTMLElement>(
                  `#${scrollToId}`,
                );
                if (element !== null) {
                  element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  const input =
                    element.querySelector<HTMLElement>("input, textarea");
                  if (input !== null) {
                    input.focus();
                  }
                }
              }, 50);
            },
          },
    actionButtonStyle: {
      background: "var(--destructive)",
    },
  });
};
