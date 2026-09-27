"use client";

import { useCompletion } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useQuotaResetTimer } from "@/hooks/use-quota-reset-timer";
import {
  AI_RESPONSE_HEADERS,
  parseQuotaExceededResponse,
} from "@/lib/ai/quota";
import { formatAIResetAt } from "@/lib/ai/usage";
import type { Question } from "@/types/quiz";

export interface QuestionCompletionState {
  completion: string;
  isLoading: boolean;
  error: Error | undefined;
  retryAfter: number | null;
  quotaResetAt: string | null;
  quotaResetLabel: string | null;
  fallbackModel: string | null;
  servedModel: string | null;
  handleStart: () => void;
  stop: () => void;
}

/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
export function useQuestionCompletion({
  api,
  defaultAiModel,
  question,
  onClose,
}: {
  api: string;
  defaultAiModel?: string | null;
  question: Question;
  onClose: () => void;
}): QuestionCompletionState {
  const startedRef = useRef(false);
  const previousQuestionId = useRef(question.id);
  const [retryResetAt, setRetryResetAt] = useState<string | null>(null);
  const [quotaResetAt, setQuotaResetAt] = useState<string | null>(null);
  const [fallbackModel, setFallbackModel] = useState<string | null>(null);
  const [servedModel, setServedModel] = useState<string | null>(null);

  const fetchWithRateLimitHandling = useCallback<typeof fetch>(
    async (input, init) => {
      const response = await fetch(input, init);
      if (response.ok) {
        const responseModel = response.headers.get(AI_RESPONSE_HEADERS.model);
        setServedModel(responseModel);
        setFallbackModel(
          response.headers.get(AI_RESPONSE_HEADERS.quotaTier) === "fallback"
            ? responseModel
            : null,
        );
      } else {
        setServedModel(null);
        setFallbackModel(null);
      }
      if (response.status !== 429) {
        setQuotaResetAt(null);
        return response;
      }

      if (response.headers.get(AI_RESPONSE_HEADERS.limitType) === "quota") {
        const quotaBody = await parseQuotaExceededResponse(response);
        setRetryResetAt(null);
        setQuotaResetAt(quotaBody?.resets_at ?? null);
        return new Response("Limit wykorzystania AI został osiągnięty.", {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      const retryAfterHeader = response.headers.get(
        AI_RESPONSE_HEADERS.retryAfter,
      );
      const parsedRetryAfter =
        retryAfterHeader === null
          ? null
          : Number.parseInt(retryAfterHeader, 10);
      const nextRetryAfter =
        parsedRetryAfter === null || Number.isNaN(parsedRetryAfter)
          ? 60
          : Math.max(1, parsedRetryAfter);
      setRetryResetAt(
        new Date(Date.now() + nextRetryAfter * 1000).toISOString(),
      );

      return new Response(
        `Osiągnięto limit zapytań AI. Spróbuj ponownie za ${nextRetryAfter.toString()} s.`,
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        },
      );
    },
    [],
  );

  const { completion, isLoading, error, complete, stop } = useCompletion({
    api,
    streamProtocol: "text",
    fetch: fetchWithRateLimitHandling,
    onError: () => {
      startedRef.current = false;
    },
  });

  const startCompletion = useCallback(() => {
    setRetryResetAt(null);
    setQuotaResetAt(null);
    setServedModel(null);
    setFallbackModel(null);
    startedRef.current = true;
    void complete("generate", {
      body: {
        question,
        config: { modelName: defaultAiModel ?? undefined },
      },
    });
  }, [complete, defaultAiModel, question]);
  const initialStartRef = useRef(startCompletion);
  initialStartRef.current = startCompletion;

  const handleStart = useCallback(() => {
    if (
      (retryResetAt !== null &&
        new Date(retryResetAt).getTime() > Date.now()) ||
      (quotaResetAt !== null && new Date(quotaResetAt).getTime() > Date.now())
    ) {
      return;
    }
    startCompletion();
  }, [quotaResetAt, retryResetAt, startCompletion]);

  useEffect(() => {
    if (previousQuestionId.current !== question.id) {
      previousQuestionId.current = question.id;
      onClose();
    }
  }, [question.id, onClose]);

  useEffect(() => {
    if (!startedRef.current) {
      initialStartRef.current();
    }
  }, []);

  const handleQuotaReset = useCallback(() => {
    setQuotaResetAt(null);
    setRetryResetAt(null);
    startedRef.current = false;
  }, []);
  const quotaClock = useQuotaResetTimer(quotaResetAt, handleQuotaReset);
  const quotaResetLabel = formatAIResetAt(quotaResetAt, "full", quotaClock);
  const handleRetryReset = useCallback(() => {
    setRetryResetAt(null);
    startedRef.current = false;
  }, []);
  const retryClock = useQuotaResetTimer(retryResetAt, handleRetryReset);
  const retryAfter =
    retryResetAt === null
      ? null
      : Math.max(
          0,
          Math.ceil((new Date(retryResetAt).getTime() - retryClock) / 1000),
        );

  return {
    completion,
    isLoading,
    error,
    retryAfter,
    quotaResetAt,
    quotaResetLabel,
    fallbackModel,
    servedModel,
    handleStart,
    stop,
  };
}
/* eslint-enable react-you-might-not-need-an-effect/no-event-handler */
