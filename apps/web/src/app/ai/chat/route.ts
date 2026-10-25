import type { Question } from "@testownik/core/quiz/types";
import { stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";

import { buildChatModelMessages } from "@/lib/ai/chat-messages";
import type { QuestionContextSnapshot } from "@/lib/ai/chat-messages";
import { buildChatTools } from "@/lib/ai/chat-tools";
import { resolveImages } from "@/lib/ai/images";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import {
  estimateJsonTokens,
  isQuestion,
  isUuid,
} from "@/lib/ai/request-validation";
import { withAiRoute } from "@/lib/ai/route.server";
import { buildUsageCallbacks } from "@/lib/ai/usage.server";

export const maxDuration = 60;

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
        tools: buildChatTools({
          questions: chatQuestions,
          canEdit: canEdit === true,
        }),
      });

      return result.toUIMessageStreamResponse();
    },
  );
}
