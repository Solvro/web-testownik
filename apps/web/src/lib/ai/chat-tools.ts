import type { Question } from "@testownik/core/quiz/types";
import { z } from "zod";

import { LANDING_DEMO_CHAT_TOOL_LIMITS as DEMO_LIMITS } from "@/lib/ai/landing-demo-chat";

/**
 * The assistant's tools, shared by the app's chat (`/ai/chat`) and the
 * landing page's demo chat (`/ai/landing-demo/chat`). They only read the
 * questions sent with the request; anything that changes a quiz is proposed
 * to the client, which applies it after the user confirms.
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

function truncateQuestionPreview(text: string): string {
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}

function buildQuizTools(questions: Question[], demo = false) {
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
      execute: (arguments_: {
        questions: z.infer<typeof practiceQuestionSchema>[];
      }) => {
        return JSON.stringify(arguments_);
      },
    },
    list_questions: {
      description:
        "Pobierz listę pytań z quizu jako krótkie podglądy. Użyj tego, gdy użytkownik prosi o listę pytań, przegląd quizu, wyszukanie podobnych pytań lub potrzebujesz kontekstu z wielu pytań.",
      inputSchema: listQuestionsSchema,
      execute: (arguments_: z.infer<typeof listQuestionsSchema>) => {
        const query = arguments_.query?.trim().toLowerCase() ?? "";
        const matchingQuestions = questions
          .toSorted((a, b) => a.order - b.order)
          .filter((q) =>
            query === "" ? true : q.text.toLowerCase().includes(query),
          );
        const limit = demo
          ? Math.min(
              arguments_.limit ?? DEMO_LIMITS.maxListQuestions,
              DEMO_LIMITS.maxListQuestions,
            )
          : (arguments_.limit ?? 50);
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
            text: demo
              ? q.text.slice(0, DEMO_LIMITS.maxListPreviewLength)
              : truncateQuestionPreview(q.text),
            answer_count: q.answers.length,
            multiple: q.multiple,
            has_explanation:
              q.explanation !== undefined && q.explanation.trim() !== "",
          })),
        });
      },
    },
    get_question: {
      description:
        "Pobierz pełne szczegóły konkretnego pytania z quizu (treść, odpowiedzi, wyjaśnienie). Użyj tego, gdy użytkownik pyta o konkretne pytanie z quizu (np. 'pokaż pytanie 5', 'wyjaśnij pytanie nr 12').",
      inputSchema: getQuestionSchema,
      execute: (arguments_: z.infer<typeof getQuestionSchema>) => {
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
          text: demo
            ? question.text.slice(0, DEMO_LIMITS.maxQuestionTextLength)
            : question.text,
          explanation:
            (demo
              ? question.explanation?.slice(0, DEMO_LIMITS.maxExplanationLength)
              : question.explanation) ?? null,
          multiple: question.multiple,
          answers: question.answers
            .slice(0, demo ? DEMO_LIMITS.maxAnswers : undefined)
            .map((a) => ({
              text: demo
                ? a.text.slice(0, DEMO_LIMITS.maxAnswerTextLength)
                : a.text,
              is_correct: a.is_correct,
            })),
        });
      },
    },
  };
}

const editQuestionTool = {
  description:
    "Zaproponuj edycję aktualnego pytania quizowego. Użyj tego, gdy student prosi o poprawienie, ulepszenie lub zmianę treści pytania, odpowiedzi lub wyjaśnienia. Edycja musi zostać zatwierdzona przez użytkownika przed zastosowaniem.",
  inputSchema: editQuestionSchema,
  execute: (arguments_: z.infer<typeof editQuestionSchema>) => {
    return JSON.stringify(arguments_);
  },
};

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
}: {
  questions: Question[];
  canEdit: boolean;
}) {
  return {
    ...buildQuizTools(questions),
    ...(canEdit ? { edit_question: editQuestionTool } : {}),
    disable_ai: disableAiTool,
  };
}

/**
 * The landing demo's tools. The visitor owns the demo quiz, so it can be
 * edited; there are no settings to switch AI off in.
 */
export function buildLandingDemoChatTools(questions: Question[]) {
  return {
    ...buildQuizTools(questions, true),
    edit_question: editQuestionTool,
  };
}
