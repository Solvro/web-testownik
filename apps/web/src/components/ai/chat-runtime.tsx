"use client";

import { useChat } from "@ai-sdk/react";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Question } from "@testownik/core/quiz/types";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

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

/** One send: what `useChat` sends and the chat's context at that moment. */
export interface ChatRequest {
  id: string;
  /** The whole history, ending on the turn being sent. */
  messages: UIMessage[];
  trigger: "submit-message" | "regenerate-message";
  messageId: string | undefined;
  requestMetadata: unknown;
  /** Extra body passed to `sendMessage`. */
  body: object | undefined;
  /** The question each user turn in `messages` was asked about. */
  questionContextSnapshots: QuestionContextSnapshot[];
  quizId: string;
  quiz: { title: string; description: string };
  question: Question | null;
  questions: Question[];
  userName?: string;
  canEdit: boolean;
  selectedModel?: string | null;
  conversationId: string;
}

/** Where the chat sends its requests and what it sends. */
export interface ChatRuntimeTransport {
  api: string;
  /** The JSON body of one request. */
  prepareBody: (request: ChatRequest) => object;
  /**
   * Every response, before the chat reads it. A returned response is read
   * instead (e.g. a canned reply when the endpoint is unavailable).
   */
  onResponse?: (
    response: Response,
    request: ChatRequest,
  ) => Response | undefined;
  /** Replies count towards the user's AI usage, refreshed after each one. */
  reportsUsage: boolean;
}

/** The app's assistant at `/ai/chat`. */
const APP_CHAT_TRANSPORT: ChatRuntimeTransport = {
  api: "/ai/chat",
  prepareBody: (request) => ({
    ...request.body,
    id: request.id,
    messages: request.messages,
    trigger: request.trigger,
    messageId: request.messageId,
    metadata: request.requestMetadata,
    questionContextSnapshots: request.questionContextSnapshots,
    quiz: request.quiz,
    question: request.question,
    questions: request.questions,
    userName: request.userName,
    canEdit: request.canEdit,
    quizId: request.quizId,
    conversationId: request.conversationId,
    config: { modelName: request.selectedModel },
  }),
  reportsUsage: true,
};

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
  /** Called with the body of a quota-exceeded response. */
  onQuotaExceeded?: (body: QuotaExceededBody) => void;
  /** Called with the model a reply came from, read from its headers. */
  onModelResolved?: (
    model: string,
    quotaTier: string | null,
    fallbackResetAt: string | null,
  ) => void;
  /** Defaults to the app's assistant at `/ai/chat`, reporting usage. */
  transport?: ChatRuntimeTransport;
  /** Replaces the default suggestions on the empty chat. */
  suggestions?: readonly string[];
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
> & { transport: ChatRuntimeTransport };

/** Imperative SDK callbacks own the mutable session; React subscribes to snapshots. */
function createRuntimeTransport({
  quizId,
  initialContext,
}: {
  quizId: string;
  initialContext: TransportContext;
}) {
  let context = initialContext;
  let lastRequest: ChatRequest | null = null;
  let snapshotList: QuestionContextSnapshot[] = [];
  const questionSnapshots = new Map<string, QuestionContextSnapshot>();
  const conversationId = crypto.randomUUID();
  const listeners = new Set<() => void>();
  const transport = new DefaultChatTransport<UIMessage>({
    api: initialContext.transport.api,
    fetch: async (input, init) => {
      const fetched = await fetch(input, init);
      const response =
        (lastRequest === null
          ? undefined
          : context.transport.onResponse?.(fetched, lastRequest)) ?? fetched;
      if (context.onQuotaExceeded !== undefined) {
        const quotaBody = await parseQuotaExceededResponse(response);
        if (quotaBody !== null) {
          context.onQuotaExceeded(quotaBody);
        }
      }
      if (response.ok && context.onModelResolved !== undefined) {
        const resolvedModel = response.headers.get(AI_RESPONSE_HEADERS.model);
        if (resolvedModel !== null) {
          context.onModelResolved(
            resolvedModel,
            response.headers.get(AI_RESPONSE_HEADERS.quotaTier),
            response.headers.get(AI_RESPONSE_HEADERS.fallbackResetAt),
          );
        }
      }
      return response;
    },
    prepareSendMessagesRequest: (options) => {
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
      const request: ChatRequest = {
        id: options.id,
        messages: options.messages,
        trigger: options.trigger,
        messageId: options.messageId,
        requestMetadata: options.requestMetadata,
        body: options.body,
        questionContextSnapshots: snapshots,
        quizId,
        quiz: current.quiz,
        question: current.question,
        questions: current.questions,
        userName: current.userName,
        canEdit: current.canEdit,
        selectedModel: current.selectedModel,
        conversationId,
      };
      lastRequest = request;

      return {
        api: current.transport.api,
        body: current.transport.prepareBody(request),
      };
    },
  });
  return {
    transport,
    updateContext(next: TransportContext) {
      context = next;
    },
    reportsUsage: () => context.transport.reportsUsage,
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
  transport = APP_CHAT_TRANSPORT,
  suggestions: suggestionsOverride,
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
        transport,
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
      transport,
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
    transport,
  ]);
  const questionContextSnapshots = useSyncExternalStore(
    transportStore.subscribe,
    transportStore.getSnapshot,
    transportStore.getSnapshot,
  );

  const chat = useChat({
    transport: transportStore.transport,
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

      if (!transportStore.reportsUsage()) {
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
