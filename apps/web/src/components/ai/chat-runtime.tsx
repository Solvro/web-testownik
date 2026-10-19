"use client";

import { useChat } from "@ai-sdk/react";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Question } from "@testownik/core/quiz/types";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { AiChatProvider } from "@/components/ai/ai-chat-context";
import { invalidateAIUsage } from "@/hooks/use-ai-usage";
import type { QuestionContextSnapshot } from "@/lib/ai/chat-messages";
import {
  LANDING_DEMO_CHAT_ENDPOINT,
  LANDING_DEMO_CHAT_LIMITS,
  trimLandingDemoChatHistory,
} from "@/lib/ai/landing-demo-chat";
import {
  AI_RESPONSE_HEADERS,
  parseQuotaExceededResponse,
} from "@/lib/ai/quota";
import type { QuotaExceededBody } from "@/lib/ai/quota";

export interface ChatRuntimeValue extends UseChatHelpers<UIMessage> {
  lengthLimitedMessageIds: ReadonlySet<string>;
  suggestions: readonly string[];
  questionContextSnapshots: readonly QuestionContextSnapshot[];
}

const USAGE_REPORT_SETTLE_DELAY_MS = 500;

function getSubmittedUserMessageId({
  trigger,
  messageId,
  messages,
}: {
  trigger: "submit-message" | "regenerate-message";
  messageId: string | undefined;
  messages: UIMessage[];
}): string | null {
  if (trigger !== "submit-message") {
    return null;
  }
  if (
    messageId !== undefined &&
    messages.some(
      (message) => message.id === messageId && message.role === "user",
    )
  ) {
    return messageId;
  }
  return messages.findLast((message) => message.role === "user")?.id ?? null;
}

export function ChatRuntime({
  quizId,
  quiz,
  question,
  questions,
  userName,
  canEdit,
  selectedModel,
  children,
  onQuotaExceeded,
  onModelResolved,
  demo = false,
  onResponse,
  suggestions: suggestionsOverride,
  initialMessages,
}: {
  quizId: string;
  quiz: { title: string; description: string };
  question: Question | null;
  questions: Question[];
  userName?: string;
  canEdit: boolean;
  selectedModel?: string | null;
  children: (runtime: ChatRuntimeValue) => ReactNode;
  onQuotaExceeded?: (body: QuotaExceededBody) => void;
  onModelResolved?: (
    model: string,
    quotaTier: string | null,
    fallbackResetAt: string | null,
  ) => void;
  /**
   * The landing page's public demo (`LANDING_DEMO_CHAT_ENDPOINT`): no account,
   * so no quota, usage or model headers, and a trimmed request.
   */
  demo?: boolean;
  /**
   * Every response, before the chat reads it (e.g. to explain a 429). A
   * returned response is read instead, which lets a demo answer offline.
   */
  onResponse?: (
    response: Response,
    sent: { messages: UIMessage[] },
  ) => Response | undefined;
  /** Replaces the default suggestions on the empty chat. */
  suggestions?: readonly string[];
  /** The conversation to continue, read once. */
  initialMessages?: UIMessage[];
}) {
  const queryClient = useQueryClient();
  const usageRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [lengthLimitedMessageIds, setLengthLimitedMessageIds] = useState(
    () => new Set<string>(),
  );
  const routeContext = useMemo(
    () => ({ quiz, question, questions, userName, canEdit, selectedModel }),
    [canEdit, quiz, question, questions, selectedModel, userName],
  );
  const routeContextRef = useRef(routeContext);
  const onQuotaExceededRef = useRef(onQuotaExceeded);
  const onModelResolvedRef = useRef(onModelResolved);
  const onResponseRef = useRef(onResponse);
  useEffect(() => {
    routeContextRef.current = routeContext;
    onQuotaExceededRef.current = onQuotaExceeded;
    onModelResolvedRef.current = onModelResolved;
    onResponseRef.current = onResponse;
  }, [onModelResolved, onQuotaExceeded, onResponse, routeContext]);

  const questionContextSnapshotsRef = useRef(
    new Map<string, QuestionContextSnapshot>(),
  );
  const conversationIdRef = useRef(crypto.randomUUID());
  const sentMessagesRef = useRef<UIMessage[]>([]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: demo ? LANDING_DEMO_CHAT_ENDPOINT : "/ai/chat",
        fetch: async (input, init) => {
          const fetched = await fetch(input, init);
          const response =
            onResponseRef.current?.(fetched, {
              messages: sentMessagesRef.current,
            }) ?? fetched;
          if (demo) {
            return response;
          }
          const quotaBody = await parseQuotaExceededResponse(response);
          if (quotaBody !== null) {
            onQuotaExceededRef.current?.(quotaBody);
          }
          if (response.ok) {
            const resolvedModel = response.headers.get(
              AI_RESPONSE_HEADERS.model,
            );
            if (resolvedModel !== null) {
              onModelResolvedRef.current?.(
                resolvedModel,
                response.headers.get(AI_RESPONSE_HEADERS.quotaTier),
                response.headers.get(AI_RESPONSE_HEADERS.fallbackResetAt),
              );
            }
          }
          return response;
        },
        prepareSendMessagesRequest: (options) => {
          sentMessagesRef.current = options.messages;
          const messageIds = new Set(
            options.messages.map((message) => message.id),
          );
          for (const messageId of questionContextSnapshotsRef.current.keys()) {
            if (!messageIds.has(messageId)) {
              questionContextSnapshotsRef.current.delete(messageId);
            }
          }

          const submittedUserMessageId = getSubmittedUserMessageId(options);
          const currentQuestion = routeContextRef.current.question;
          if (submittedUserMessageId !== null) {
            if (currentQuestion === null) {
              questionContextSnapshotsRef.current.delete(
                submittedUserMessageId,
              );
            } else {
              questionContextSnapshotsRef.current.set(submittedUserMessageId, {
                messageId: submittedUserMessageId,
                questionId: currentQuestion.id,
              });
            }
          }

          const questionContextSnapshots = options.messages
            .map((message) =>
              questionContextSnapshotsRef.current.get(message.id),
            )
            .filter(
              (snapshot): snapshot is QuestionContextSnapshot =>
                snapshot !== undefined,
            );
          const current = routeContextRef.current;

          if (demo) {
            const messages = trimLandingDemoChatHistory(options.messages);
            const sentIds = new Set(messages.map((message) => message.id));
            return {
              body: {
                messages,
                questionContextSnapshots: questionContextSnapshots.filter(
                  (snapshot) => sentIds.has(snapshot.messageId),
                ),
                question: current.question,
                questions: current.questions.slice(
                  0,
                  LANDING_DEMO_CHAT_LIMITS.maxQuestions,
                ),
              },
            };
          }

          return {
            body: {
              ...options.body,
              id: options.id,
              messages: options.messages,
              trigger: options.trigger,
              messageId: options.messageId,
              metadata: options.requestMetadata,
              questionContextSnapshots,
              quiz: current.quiz,
              question: current.question,
              questions: current.questions,
              userName: current.userName,
              canEdit: current.canEdit,
              quizId,
              conversationId: conversationIdRef.current,
              config: { modelName: current.selectedModel },
            },
          };
        },
      }),
    [demo, quizId],
  );

  useEffect(
    () => () => {
      if (usageRefreshTimerRef.current !== null) {
        clearTimeout(usageRefreshTimerRef.current);
      }
    },
    [],
  );

  const chat = useChat({
    transport,
    messages: initialMessages,
    onFinish: ({ message, finishReason }) => {
      setLengthLimitedMessageIds((current) => {
        if (finishReason !== "length" && !current.has(message.id)) {
          return current;
        }
        const next = new Set(current);
        if (finishReason === "length") {
          next.add(message.id);
        } else {
          next.delete(message.id);
        }
        return next;
      });

      if (demo) {
        return;
      }
      if (usageRefreshTimerRef.current !== null) {
        clearTimeout(usageRefreshTimerRef.current);
      }
      usageRefreshTimerRef.current = setTimeout(() => {
        usageRefreshTimerRef.current = null;
        void invalidateAIUsage(queryClient);
      }, USAGE_REPORT_SETTLE_DELAY_MS);
    },
  });
  const defaultSuggestions = useMemo(() => {
    const prompts = [
      "Wyjaśnij to pytanie",
      "Podaj wskazówkę do odpowiedzi",
      "Znajdź podobne pytania w tym quizie",
      ...(canEdit
        ? [
            "Popraw literówki w tym pytaniu",
            "Wygeneruj 5 podobnych pytań",
            "Dodaj wyjaśnienie odpowiedzi",
            "Popraw formatowanie tego pytania",
            "Uprość to pytanie",
          ]
        : []),
    ];
    return prompts.slice(0, 2);
  }, [canEdit]);
  const suggestions = suggestionsOverride ?? defaultSuggestions;
  const runtime: ChatRuntimeValue = {
    ...chat,
    lengthLimitedMessageIds,
    suggestions,
    questionContextSnapshots: [...questionContextSnapshotsRef.current.values()],
  };
  const chatContext = useMemo(
    () => ({
      quizId,
      questionId: question?.id ?? null,
      question,
      questions,
      canEdit,
    }),
    [quizId, question, questions, canEdit],
  );

  return (
    <AiChatProvider value={chatContext}>{children(runtime)}</AiChatProvider>
  );
}
