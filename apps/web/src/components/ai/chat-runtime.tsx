"use client";

import { useChat } from "@ai-sdk/react";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Question } from "@testownik/core/quiz/types";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import {
  LANDING_DEMO_CHAT_ENDPOINT,
  LANDING_DEMO_CHAT_LIMITS,
  trimLandingDemoChatHistory,
} from "@/app/(landing)/lib/landing-demo-chat";
import { AiChatProvider } from "@/components/ai/ai-chat-context";
import { invalidateAIUsage } from "@/hooks/use-ai-usage";
import type { QuestionContextSnapshot } from "@/lib/ai/chat-messages";
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

interface ChatRuntimeProps {
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
}

type TransportContext = Pick<
  ChatRuntimeProps,
  | "quiz"
  | "question"
  | "questions"
  | "userName"
  | "canEdit"
  | "selectedModel"
  | "onQuotaExceeded"
  | "onModelResolved"
  | "onResponse"
>;

/** Imperative SDK callbacks own the mutable session; React subscribes to snapshots. */
function createRuntimeTransport({
  demo,
  quizId,
  initialContext,
}: {
  demo: boolean;
  quizId: string;
  initialContext: TransportContext;
}) {
  let context = initialContext;
  let sentMessages: UIMessage[] = [];
  let snapshotList: QuestionContextSnapshot[] = [];
  const questionSnapshots = new Map<string, QuestionContextSnapshot>();
  const conversationId = crypto.randomUUID();
  const listeners = new Set<() => void>();
  const transport = new DefaultChatTransport<UIMessage>({
    api: demo ? LANDING_DEMO_CHAT_ENDPOINT : "/ai/chat",
    fetch: async (input, init) => {
      const fetched = await fetch(input, init);
      const response =
        context.onResponse?.(fetched, {
          messages: sentMessages,
        }) ?? fetched;
      if (demo) {
        return response;
      }
      const quotaBody = await parseQuotaExceededResponse(response);
      if (quotaBody !== null) {
        context.onQuotaExceeded?.(quotaBody);
      }
      if (response.ok) {
        const resolvedModel = response.headers.get(AI_RESPONSE_HEADERS.model);
        if (resolvedModel !== null) {
          context.onModelResolved?.(
            resolvedModel,
            response.headers.get(AI_RESPONSE_HEADERS.quotaTier),
            response.headers.get(AI_RESPONSE_HEADERS.fallbackResetAt),
          );
        }
      }
      return response;
    },
    prepareSendMessagesRequest: (options) => {
      sentMessages = options.messages;
      const messageIds = new Set(options.messages.map((message) => message.id));
      for (const messageId of questionSnapshots.keys()) {
        if (!messageIds.has(messageId)) {
          questionSnapshots.delete(messageId);
        }
      }

      const submittedUserMessageId = getSubmittedUserMessageId(options);
      const currentQuestion = context.question;
      if (submittedUserMessageId !== null) {
        if (currentQuestion === null) {
          questionSnapshots.delete(submittedUserMessageId);
        } else {
          questionSnapshots.set(submittedUserMessageId, {
            messageId: submittedUserMessageId,
            questionId: currentQuestion.id,
          });
        }
      }

      const snapshots = options.messages
        .map((message) => questionSnapshots.get(message.id))
        .filter(
          (snapshot): snapshot is QuestionContextSnapshot =>
            snapshot !== undefined,
        );
      snapshotList = snapshots;
      for (const listener of listeners) {
        listener();
      }
      const current = context;

      if (demo) {
        const messages = trimLandingDemoChatHistory(options.messages);
        const sentIds = new Set(messages.map((message) => message.id));
        return {
          body: {
            messages,
            questionContextSnapshots: snapshots.filter((snapshot) =>
              sentIds.has(snapshot.messageId),
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
          questionContextSnapshots: snapshots,
          quiz: current.quiz,
          question: current.question,
          questions: current.questions,
          userName: current.userName,
          canEdit: current.canEdit,
          quizId,
          conversationId,
          config: { modelName: current.selectedModel },
        },
      };
    },
  });
  return {
    transport,
    updateContext(next: TransportContext) {
      context = next;
    },
    getSnapshot: () => snapshotList,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
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
}: ChatRuntimeProps) {
  const queryClient = useQueryClient();
  const usageRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [lengthLimitedMessageIds, setLengthLimitedMessageIds] = useState(
    () => new Set<string>(),
  );
  // The store identity never changes; useSyncExternalStore subscribes to updates.
  // eslint-disable-next-line react/hook-use-state
  const [transportStore] = useState(() =>
    createRuntimeTransport({
      demo,
      quizId,
      initialContext: {
        quiz,
        question,
        questions,
        userName,
        canEdit,
        selectedModel,
        onQuotaExceeded,
        onModelResolved,
        onResponse,
      },
    }),
  );
  useEffect(() => {
    transportStore.updateContext({
      quiz,
      question,
      questions,
      userName,
      canEdit,
      selectedModel,
      onQuotaExceeded,
      onModelResolved,
      onResponse,
    });
  }, [
    transportStore,
    quiz,
    question,
    questions,
    userName,
    canEdit,
    selectedModel,
    onQuotaExceeded,
    onModelResolved,
    onResponse,
  ]);
  const questionContextSnapshots = useSyncExternalStore(
    transportStore.subscribe,
    transportStore.getSnapshot,
    transportStore.getSnapshot,
  );

  const chat = useChat({
    transport: transportStore.transport,
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
  const { stop } = chat;
  useEffect(
    () => () => {
      void stop();
      if (usageRefreshTimerRef.current !== null) {
        clearTimeout(usageRefreshTimerRef.current);
      }
    },
    [stop],
  );
  const defaultSuggestions = [
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
  ].slice(0, 2);
  const suggestions = suggestionsOverride ?? defaultSuggestions;
  const runtime: ChatRuntimeValue = {
    ...chat,
    lengthLimitedMessageIds,
    suggestions,
    questionContextSnapshots,
  };
  const chatContext = {
    quizId,
    questionId: question?.id ?? null,
    question,
    questions,
    canEdit,
  };

  return (
    <AiChatProvider value={chatContext}>{children(runtime)}</AiChatProvider>
  );
}
