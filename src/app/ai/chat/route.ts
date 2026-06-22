import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { stepCountIs, streamText } from "ai";
import type { JSONSchema7, LanguageModel, UIMessage } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { buildChatModelMessages } from "@/lib/ai/chat-messages";
import type { QuestionContextSnapshot } from "@/lib/ai/chat-messages";
import { resolveImages } from "@/lib/ai/images";
import { getChatModelForUser } from "@/lib/ai/model";
import { isAiModel } from "@/lib/ai/models";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import {
  checkRateLimit,
  createRateLimitExceededResponse,
  createRateLimitHeaders,
} from "@/lib/ai/rate-limit";
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
import { getServerCurrentUser } from "@/lib/auth/utils.server";
import type { Question } from "@/types/quiz";

export const maxDuration = 60;

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

export async function POST(request: Request) {
  if (!env.NEXT_PUBLIC_AI_ENABLED) {
    return new Response("AI is not configured", { status: 503 });
  }

  const user = await getServerCurrentUser();
  if (user == null) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasPermission(user.account_type, PermissionAction.AI_FEATURES)) {
    return new Response("AI features require a full account", { status: 403 });
  }

  const rateLimitResult = checkRateLimit(user.user_id, "ai-chat", {
    limit: env.AI_CHAT_RATE_LIMIT,
    window: env.AI_CHAT_RATE_WINDOW,
  });
  const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return createRateLimitExceededResponse(rateLimitResult);
  }

  const {
    messages,
    quiz: requestQuiz,
    question: requestQuestion,
    questions: requestQuestions,
    userName,
    canEdit,
    questionContextChange,
    questionContextSnapshots,
    config,
    tools: clientTools,
  } = (await request.json()) as {
    messages: UIMessage[];
    quiz?: { title: string; description: string };
    question?: Question | null;
    questions?: Question[];
    userName?: string;
    canEdit?: boolean;
    questionContextChange?: {
      previousQuestionOrder?: number | null;
    };
    questionContextSnapshots?: QuestionContextSnapshot[];
    config?: { modelName?: unknown };
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  };

  const aiModel = isAiModel(config?.modelName) ? config.modelName : undefined;

  let model: LanguageModel;
  try {
    model = getChatModelForUser({
      accountLevel: user.account_level,
      requestedModel: aiModel,
    });
  } catch (error) {
    console.error("Failed to resolve AI chat model", error);
    return new Response("AI model is not configured", { status: 503 });
  }

  const chatQuestion = requestQuestion ?? null;
  const chatQuestions = requestQuestions ?? [];
  const modelMessages = await buildChatModelMessages({
    messages,
    chatQuestion,
    chatQuestions,
    questionContextSnapshots,
    legacyQuestionContextChange: questionContextChange,
    resolveQuestionImages: resolveImages,
  });
  const system = buildChatSystemPrompt(
    requestQuiz ?? { title: "Quiz", description: "" },
    chatQuestions.length,
    userName,
    canEdit,
  );

  const result = streamText({
    model,
    system,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      ...frontendTools(clientTools ?? {}),
      generate_practice_questions: {
        description:
          "Wygeneruj pytania quizowe do ćwiczeń, aby student mógł sprawdzić swoją wiedzę. Użyj tego, gdy student prosi o pytanie ćwiczeniowe, podobne pytanie lub chce się sprawdzić. Zawsze generuj pytania przez to narzędzie — jedno lub wiele.",
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
          const matchingQuestions = chatQuestions
            .toSorted((a, b) => a.order - b.order)
            .filter((q) =>
              query === "" ? true : q.text.toLowerCase().includes(query),
            );
          const limit = arguments_.limit ?? 50;
          const offset = arguments_.offset ?? 0;
          const page = matchingQuestions.slice(offset, offset + limit);
          const nextOffset =
            offset + limit < matchingQuestions.length ? offset + limit : null;

          return JSON.stringify({
            total: chatQuestions.length,
            matched: matchingQuestions.length,
            returned: page.length,
            offset,
            next_offset: nextOffset,
            questions: page.map((q) => ({
              order: q.order,
              text: truncateQuestionPreview(q.text),
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
          const question = chatQuestions.find(
            (q) => q.order === arguments_.question_order,
          );
          if (question === undefined) {
            return JSON.stringify({
              error: `Nie znaleziono pytania nr ${arguments_.question_order.toString()}. Quiz ma ${chatQuestions.length.toString()} pytań.`,
            });
          }

          return JSON.stringify({
            order: question.order,
            text: question.text,
            explanation: question.explanation ?? null,
            multiple: question.multiple,
            answers: question.answers.map((a) => ({
              text: a.text,
              is_correct: a.is_correct,
            })),
          });
        },
      },
      ...(canEdit === true
        ? {
            edit_question: {
              description:
                "Zaproponuj edycję aktualnego pytania quizowego. Użyj tego, gdy student prosi o poprawienie, ulepszenie lub zmianę treści pytania, odpowiedzi lub wyjaśnienia. Edycja musi zostać zatwierdzona przez użytkownika przed zastosowaniem.",
              inputSchema: editQuestionSchema,
              execute: (arguments_: z.infer<typeof editQuestionSchema>) => {
                return JSON.stringify(arguments_);
              },
            },
          }
        : {}),
      disable_ai: {
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
      },
    },
  });

  return result.toUIMessageStreamResponse({
    headers: rateLimitHeaders,
  });
}
