import { stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";

import { buildChatModelMessages } from "@/lib/ai/chat-messages";
import type { QuestionContextSnapshot } from "@/lib/ai/chat-messages";
import { resolveImages } from "@/lib/ai/images";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import {
  estimateJsonTokens,
  isQuestion,
  isUuid,
} from "@/lib/ai/request-validation";
import { withAiRoute } from "@/lib/ai/route.server";
import { buildUsageCallbacks } from "@/lib/ai/usage.server";
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

interface ChatBody {
  messages: UIMessage[];
  quiz?: { title: string; description: string };
  question?: Question | null;
  questions?: Question[];
  userName?: string;
  canEdit?: boolean;
  questionContextChange?: { previousQuestionOrder?: number | null };
  questionContextSnapshots?: QuestionContextSnapshot[];
  config?: { modelName?: unknown };
  conversationId?: string;
  quizId?: string;
}

const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_QUESTIONS = 500;
const MAX_CONTEXT_SNAPSHOTS = 200;
const MAX_MESSAGE_LENGTH = 250_000;
const MAX_REQUEST_LENGTH = 2_000_000;

function parseChatBody(value: unknown): ChatBody | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const body = value as Record<string, unknown>;
  const validMessages =
    Array.isArray(body.messages) &&
    body.messages.length <= MAX_CHAT_MESSAGES &&
    body.messages.every((message: unknown) => {
      if (typeof message !== "object" || message === null) {
        return false;
      }
      const candidate = message as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        candidate.id.length <= 100 &&
        ["user", "assistant", "system"].includes(String(candidate.role)) &&
        Array.isArray(candidate.parts) &&
        candidate.parts.length <= 100 &&
        JSON.stringify(candidate).length <= MAX_MESSAGE_LENGTH
      );
    });
  const validQuiz =
    body.quiz === undefined ||
    (typeof body.quiz === "object" &&
      body.quiz !== null &&
      "title" in body.quiz &&
      typeof body.quiz.title === "string" &&
      body.quiz.title.length <= 500 &&
      "description" in body.quiz &&
      typeof body.quiz.description === "string" &&
      body.quiz.description.length <= 20_000);
  const validQuestions =
    body.questions === undefined ||
    (Array.isArray(body.questions) &&
      body.questions.length <= MAX_CHAT_QUESTIONS &&
      body.questions.every(isQuestion));
  const validCurrentQuestion =
    body.question === undefined ||
    body.question === null ||
    isQuestion(body.question);
  const validSnapshots =
    body.questionContextSnapshots === undefined ||
    (Array.isArray(body.questionContextSnapshots) &&
      body.questionContextSnapshots.length <= MAX_CONTEXT_SNAPSHOTS &&
      body.questionContextSnapshots.every((snapshot: unknown) => {
        if (typeof snapshot !== "object" || snapshot === null) {
          return false;
        }
        const candidate = snapshot as Record<string, unknown>;
        return (
          typeof candidate.messageId === "string" &&
          typeof candidate.questionId === "string"
        );
      }));
  const validScalars =
    (body.userName === undefined || typeof body.userName === "string") &&
    (typeof body.userName !== "string" || body.userName.length <= 200) &&
    (body.canEdit === undefined || typeof body.canEdit === "boolean") &&
    (body.conversationId === undefined || isUuid(body.conversationId)) &&
    (body.quizId === undefined || isUuid(body.quizId));
  const validContextChange =
    body.questionContextChange === undefined ||
    (typeof body.questionContextChange === "object" &&
      body.questionContextChange !== null &&
      (!("previousQuestionOrder" in body.questionContextChange) ||
        body.questionContextChange.previousQuestionOrder === undefined ||
        body.questionContextChange.previousQuestionOrder === null ||
        typeof body.questionContextChange.previousQuestionOrder === "number"));
  const serializedLength = JSON.stringify(value).length;
  return serializedLength <= MAX_REQUEST_LENGTH &&
    validMessages &&
    validQuiz &&
    validQuestions &&
    validCurrentQuestion &&
    validSnapshots &&
    validScalars &&
    validContextChange
    ? (value as ChatBody)
    : null;
}

function estimateLatestMessageTokens(messages: UIMessage[]): number {
  const latest = messages.at(-1);
  return latest === undefined ? 0 : estimateJsonTokens(latest.parts);
}

export async function POST(request: Request) {
  return withAiRoute(
    {
      request,
      scope: "chat",
      parseBody: parseChatBody,
      requestedModel: ({ config }) =>
        typeof config?.modelName === "string" && config.modelName !== ""
          ? config.modelName
          : undefined,
      estimateInputTokens: ({ messages }) =>
        estimateLatestMessageTokens(messages),
      prepare: async (
        {
          messages,
          question: requestQuestion,
          questions: requestQuestions,
          questionContextSnapshots,
          questionContextChange,
        },
        signal,
      ) =>
        await buildChatModelMessages({
          messages,
          chatQuestion: requestQuestion ?? null,
          chatQuestions: requestQuestions ?? [],
          questionContextSnapshots,
          legacyQuestionContextChange: questionContextChange,
          resolveQuestionImages: async (images) =>
            await resolveImages(images, signal),
        }),
    },
    ({
      body,
      model,
      quota,
      selectedModel,
      signal,
      user,
      prepared: modelMessages,
    }) => {
      const {
        messages,
        quiz: requestQuiz,
        questions: requestQuestions,
        userName,
        canEdit,
        conversationId,
        quizId,
      } = body;

      const chatQuestions = requestQuestions ?? [];
      const system = buildChatSystemPrompt(
        requestQuiz ?? { title: "Quiz", description: "" },
        chatQuestions.length,
        userName,
        canEdit,
      );
      const requestId = crypto.randomUUID();
      const startedAt = Date.now();
      const latestUserMessage = messages.findLast(
        (message) => message.role === "user",
      );
      const messageDelta =
        latestUserMessage === undefined ? [] : [latestUserMessage];
      const usageCallbacks = buildUsageCallbacks({
        payload: {
          user_id: user.user_id,
          scope: "chat",
          model: selectedModel,
          fallback_grant_id: quota.fallback_grant_id ?? undefined,
          conversation_id: conversationId,
          quiz_id: quizId,
          metadata: { messages_mode: "append" },
          messages: messageDelta,
        },
        requestId,
        startedAt,
        finishExtras: ({ text, toolCalls }) => ({
          metadata: {
            messages_mode: "append",
            tool_usage_count: toolCalls?.length ?? 0,
          },
          messages: [
            ...messageDelta,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              parts: [{ type: "text", text: text ?? "" }],
              model: selectedModel,
            },
          ],
        }),
      });
      const maxOutputTokens = quota.suggested_max_output_tokens;

      const result = streamText({
        model,
        abortSignal: signal,
        system,
        messages: modelMessages,
        stopWhen: stepCountIs(5),
        maxOutputTokens,
        ...usageCallbacks,
        tools: {
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
                offset + limit < matchingQuestions.length
                  ? offset + limit
                  : null;

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

      return result.toUIMessageStreamResponse();
    },
  );
}
