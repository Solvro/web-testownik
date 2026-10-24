import type { Question } from "@testownik/core/quiz/types";
import { z } from "zod";

/**
 * The assistant's tools. They only read the questions sent with the request;
 * anything that changes a quiz is proposed to the client, which applies it
 * after the user confirms.
 */

const practiceQuestionSchema = z.object({
  text: z.string().describe("Treść pytania (może zawierać markdown/LaTeX)"),
  answers: z
    .array(
      z.object({
        text: z.string().describe("Treść odpowiedzi"),
        is_correct: z.boolean().describe("Czy to jest poprawna odpowiedź"),
      }),
    )
    .min(2)
    .max(6)
    .describe("Opcje odpowiedzi (2-6 odpowiedzi, przynajmniej jedna poprawna)"),
  explanation: z
    .string()
    .optional()
    .describe("Krótkie wyjaśnienie poprawnej odpowiedzi"),
});

const editQuestionSchema = z.object({
  text: z.string().describe("Zaktualizowana treść pytania"),
  answers: z
    .array(
      z.object({
        text: z.string().describe("Treść odpowiedzi"),
        is_correct: z.boolean().describe("Czy to jest poprawna odpowiedź"),
      }),
    )
    .min(2)
    .max(6)
    .describe("Zaktualizowane opcje odpowiedzi"),
  explanation: z
    .string()
    .optional()
    .describe("Zaktualizowane lub nowe wyjaśnienie poprawnej odpowiedzi"),
});

const getQuestionSchema = z.object({
  question_order: z
    .number()
    .int()
    .min(1)
    .describe("Numer pytania w quizie (1-indexed)"),
});

const listQuestionsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Opcjonalna fraza do filtrowania listy pytań po treści"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maksymalna liczba pytań do zwrócenia. Domyślnie 50."),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Liczba pasujących pytań do pominięcia przy stronicowaniu"),
});

/**
 * Bounds on what the tools return. Results become model input on the next
 * inference step; a bound left out is not applied.
 */
export interface ChatToolLimits {
  /** Questions on a `list_questions` page when the model asks for no count. */
  defaultListQuestions: number;
  /** The most questions on a page, whatever the model asks for. */
  maxListQuestions?: number;
  /** Characters of each question in a list; longer ones end with "…". */
  listPreviewLength: number;
  maxQuestionTextLength?: number;
  maxAnswers?: number;
  maxAnswerTextLength?: number;
  maxExplanationLength?: number;
  /** A result over this budget is replaced by an error for the model. */
  maxOutput?: { tokens: number; countTokens: (text: string) => number };
}

export const DEFAULT_CHAT_TOOL_LIMITS: ChatToolLimits = {
  defaultListQuestions: 50,
  listPreviewLength: 180,
};

export const TOOL_OUTPUT_TOO_LARGE_ERROR = "tool_output_too_large";

function truncate(text: string, length: number | undefined): string {
  return length === undefined ? text : text.slice(0, length);
}

function truncateQuestionPreview(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function boundOutput<T>(
  limits: ChatToolLimits,
  execute: (input: T) => string,
): (input: T) => string {
  const { maxOutput } = limits;
  if (maxOutput === undefined) {
    return execute;
  }
  return (input: T) => {
    const output = execute(input);
    return maxOutput.countTokens(output) <= maxOutput.tokens
      ? output
      : JSON.stringify({ error: TOOL_OUTPUT_TOO_LARGE_ERROR });
  };
}

/** The tools that read the quiz and propose new questions. */
export function buildQuizTools(
  questions: Question[],
  limits: ChatToolLimits = DEFAULT_CHAT_TOOL_LIMITS,
) {
  return {
    generate_practice_questions: {
      description:
        "Wygeneruj pytania quizowe do ćwiczeń, aby student mógł sprawdzić swoją wiedzę. Użyj tego, gdy student prosi o pytanie ćwiczeniowe, podobne pytanie lub chce się sprawdzić. Zawsze generuj pytania przez to narzędzie - jedno lub wiele.",
      inputSchema: z.object({
        questions: z
          .array(practiceQuestionSchema)
          .min(1)
          .describe("Lista wygenerowanych pytań"),
      }),
      execute: boundOutput(
        limits,
        (arguments_: { questions: z.infer<typeof practiceQuestionSchema>[] }) =>
          JSON.stringify(arguments_),
      ),
    },
    list_questions: {
      description:
        "Pobierz listę pytań z quizu jako krótkie podglądy. Użyj tego, gdy użytkownik prosi o listę pytań, przegląd quizu, wyszukanie podobnych pytań lub potrzebujesz kontekstu z wielu pytań.",
      inputSchema: listQuestionsSchema,
      execute: boundOutput(
        limits,
        (arguments_: z.infer<typeof listQuestionsSchema>) => {
          const query = arguments_.query?.trim().toLowerCase() ?? "";
          const matchingQuestions = questions
            .toSorted((a, b) => a.order - b.order)
            .filter((q) =>
              query === "" ? true : q.text.toLowerCase().includes(query),
            );
          const limit = Math.min(
            arguments_.limit ?? limits.defaultListQuestions,
            limits.maxListQuestions ?? Number.POSITIVE_INFINITY,
          );
          const offset = arguments_.offset ?? 0;
          const page = matchingQuestions.slice(offset, offset + limit);
          const nextOffset =
            offset + limit < matchingQuestions.length ? offset + limit : null;

          return JSON.stringify({
            total: questions.length,
            matched: matchingQuestions.length,
            returned: page.length,
            offset,
            next_offset: nextOffset,
            questions: page.map((q) => ({
              order: q.order,
              text: truncateQuestionPreview(q.text, limits.listPreviewLength),
              answer_count: q.answers.length,
              multiple: q.multiple,
              has_explanation:
                q.explanation !== undefined && q.explanation.trim() !== "",
            })),
          });
        },
      ),
    },
    get_question: {
      description:
        "Pobierz pełne szczegóły konkretnego pytania z quizu (treść, odpowiedzi, wyjaśnienie). Użyj tego, gdy użytkownik pyta o konkretne pytanie z quizu (np. 'pokaż pytanie 5', 'wyjaśnij pytanie nr 12').",
      inputSchema: getQuestionSchema,
      execute: boundOutput(
        limits,
        (arguments_: z.infer<typeof getQuestionSchema>) => {
          const question = questions.find(
            (q) => q.order === arguments_.question_order,
          );
          if (question === undefined) {
            return JSON.stringify({
              error: `Nie znaleziono pytania nr ${arguments_.question_order.toString()}. Quiz ma ${questions.length.toString()} pytań.`,
            });
          }

          return JSON.stringify({
            order: question.order,
            text: truncate(question.text, limits.maxQuestionTextLength),
            explanation:
              question.explanation === undefined
                ? null
                : truncate(question.explanation, limits.maxExplanationLength),
            multiple: question.multiple,
            answers: question.answers.slice(0, limits.maxAnswers).map((a) => ({
              text: truncate(a.text, limits.maxAnswerTextLength),
              is_correct: a.is_correct,
            })),
          });
        },
      ),
    },
  };
}

/** Proposes an edit of the current question, applied once the user confirms. */
export function buildEditQuestionTool(
  limits: ChatToolLimits = DEFAULT_CHAT_TOOL_LIMITS,
) {
  return {
    description:
      "Zaproponuj edycję aktualnego pytania quizowego. Użyj tego, gdy student prosi o poprawienie, ulepszenie lub zmianę treści pytania, odpowiedzi lub wyjaśnienia. Edycja musi zostać zatwierdzona przez użytkownika przed zastosowaniem.",
    inputSchema: editQuestionSchema,
    execute: boundOutput(
      limits,
      (arguments_: z.infer<typeof editQuestionSchema>) =>
        JSON.stringify(arguments_),
    ),
  };
}

const disableAiTool = {
  description:
    "Zaproponuj wyłączenie wszystkich funkcji AI w aplikacji. Użyj tego TYLKO gdy użytkownik wyraźnie mówi, że nie chce korzystać z AI, nie potrzebuje AI, lub prosi o wyłączenie/usunięcie AI. Wymaga potwierdzenia użytkownika.",
  inputSchema: z.object({
    reason: z
      .string()
      .describe(
        "Krótkie wyjaśnienie dlaczego AI proponuje wyłączenie (np. na prośbę użytkownika)",
      ),
  }),
  execute: (arguments_: { reason: string }) => {
    return JSON.stringify({
      action: "disable_ai",
      reason: arguments_.reason,
    });
  },
};

/** The app chat's tools: `edit_question` only for editors. */
export function buildChatTools({
  questions,
  canEdit,
  limits = DEFAULT_CHAT_TOOL_LIMITS,
}: {
  questions: Question[];
  canEdit: boolean;
  limits?: ChatToolLimits;
}) {
  return {
    ...buildQuizTools(questions, limits),
    ...(canEdit ? { edit_question: buildEditQuestionTool(limits) } : {}),
    disable_ai: disableAiTool,
  };
}
