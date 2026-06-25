"use client";

import { useCompletion } from "@ai-sdk/react";
import {
  AlertCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { resolveSelectableAiModel } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/quiz";

export interface AnswerHint {
  answerIndex: number;
  hint: string;
}

function parseHints(text: string): {
  generalHint: string | null;
  answerHints: AnswerHint[];
} {
  let generalHint: string | null = null;
  const answerHints: AnswerHint[] = [];

  const gStart = text.indexOf("<general_hint>");
  if (gStart !== -1) {
    const gEnd = text.indexOf("</general_hint>", gStart);
    const content =
      gEnd === -1 ? text.slice(gStart + 14) : text.slice(gStart + 14, gEnd);
    const cleaned = content.replaceAll(/<[^>]*>?$/g, "").trim();
    if (cleaned !== "") {
      generalHint = cleaned;
    }
  }

  const hintRegex = /<hint answer="(\d+)">/g;
  let match = hintRegex.exec(text);
  while (match !== null) {
    const index = Number.parseInt(match[1], 10) - 1;
    const contentStart = match.index + match[0].length;
    const endTag = text.indexOf("</hint>", contentStart);
    const raw =
      endTag === -1
        ? text.slice(contentStart)
        : text.slice(contentStart, endTag);
    const cleaned = raw
      .replaceAll(/<\/?(?:hint|answer_hints)[^>]*>?$/g, "")
      .trim();
    if (cleaned !== "") {
      answerHints.push({ answerIndex: index, hint: cleaned });
    }
    match = hintRegex.exec(text);
  }

  return { generalHint, answerHints };
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-2 py-3">
      <span className="text-muted-foreground text-xs">Myślę</span>
      <span className="flex gap-1">
        <span className="bg-primary/50 size-1.5 animate-bounce rounded-full" />
        <span className="bg-primary/50 size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
        <span className="bg-primary/50 size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
      </span>
    </div>
  );
}

interface CompletionState {
  completion: string;
  isLoading: boolean;
  error: Error | undefined;
  retryAfter: number | null;
  handleStart: () => void;
  stop: () => void;
}

/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
function useQuestionCompletion({
  api,
  defaultAiModel,
  question,
  onClose,
}: {
  api: string;
  defaultAiModel?: string | null;
  question: Question;
  onClose: () => void;
}): CompletionState {
  const startedRef = useRef(false);
  const previousQuestionId = useRef(question.id);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const fetchWithRateLimitHandling = useCallback<typeof fetch>(
    async (input, init) => {
      const response = await fetch(input, init);
      if (response.status !== 429) {
        return response;
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const parsedRetryAfter =
        retryAfterHeader === null
          ? null
          : Number.parseInt(retryAfterHeader, 10);
      const nextRetryAfter =
        parsedRetryAfter === null || Number.isNaN(parsedRetryAfter)
          ? 60
          : Math.max(1, parsedRetryAfter);

      setRetryAfter(nextRetryAfter);

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
    setRetryAfter(null);
    startedRef.current = true;
    void complete("generate", {
      body: {
        question,
        config: {
          modelName: resolveSelectableAiModel(defaultAiModel),
        },
      },
    });
  }, [complete, defaultAiModel, question]);

  const handleStart = useCallback(() => {
    if (retryAfter !== null && retryAfter > 0) {
      return;
    }
    startCompletion();
  }, [retryAfter, startCompletion]);

  useEffect(() => {
    if (previousQuestionId.current !== question.id) {
      previousQuestionId.current = question.id;
      onClose();
    }
  }, [question.id, onClose]);

  useEffect(() => {
    if (!startedRef.current) {
      startCompletion();
    }
  }, [startCompletion]);

  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRetryAfter((current) =>
        current === null || current <= 1 ? 0 : current - 1,
      );
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [retryAfter]);

  return { completion, isLoading, error, retryAfter, handleStart, stop };
}
/* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

function AiCardShell({
  title,
  isLoading,
  error,
  errorMessage,
  retryAfter,
  onRetry,
  onStop,
  onClose,
  children,
  emphasized = false,
}: {
  title: string;
  isLoading: boolean;
  error: Error | undefined;
  errorMessage: string | undefined;
  retryAfter: number | null;
  onRetry: () => void;
  onStop: () => void;
  onClose: () => void;
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <Card
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
        emphasized &&
          "border-primary/20 from-primary/5 bg-linear-to-br to-transparent",
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="bg-primary/10 flex size-6 items-center justify-center rounded-full">
              <SparklesIcon
                className={cn(
                  "text-primary size-3.5",
                  isLoading && "animate-pulse",
                )}
              />
            </div>
            {title}
          </div>
          <div className="flex items-center gap-1">
            {isLoading ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onStop}
                aria-label="Zatrzymaj"
              >
                <SquareIcon className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRetry}
                aria-label="Wygeneruj ponownie"
              >
                <RefreshCwIcon className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Zamknij"
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error === undefined ? null : (
          <div className="flex items-center gap-3 py-2">
            <AlertCircleIcon className="text-destructive size-4 shrink-0" />
            <span className="text-muted-foreground text-xs">
              {errorMessage}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retryAfter !== null && retryAfter > 0}
              className="ml-auto"
            >
              <RefreshCwIcon className="size-3" />
              Ponów
            </Button>
          </div>
        )}
        {children}
        <AiDisclaimer className="mt-4 border-t pt-2" />
      </CardContent>
    </Card>
  );
}

interface AiHintCardProps {
  defaultAiModel?: string | null;
  question: Question;
  onClose: () => void;
  onAnswerHints?: (hints: AnswerHint[]) => void;
}

export function AiHintCard({
  defaultAiModel,
  question,
  onClose,
  onAnswerHints,
}: AiHintCardProps) {
  const lastHintsRef = useRef<string>("");
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  const { completion, isLoading, error, retryAfter, handleStart, stop } =
    useQuestionCompletion({
      api: "/ai/hint",
      defaultAiModel,
      question,
      onClose,
    });
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-data-to-parent, react-you-might-not-need-an-effect/no-pass-live-state-to-parent */
  useEffect(() => {
    if (completion !== "" && onAnswerHints !== undefined) {
      const { answerHints } = parseHints(completion);
      const hintsKey = JSON.stringify(answerHints);
      if (answerHints.length > 0 && hintsKey !== lastHintsRef.current) {
        lastHintsRef.current = hintsKey;
        onAnswerHints(answerHints);
      }
    }
  }, [completion, onAnswerHints]);
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-data-to-parent, react-you-might-not-need-an-effect/no-pass-live-state-to-parent */

  const { displayContent, hasAnswerHintsOnly } = useMemo(() => {
    const { generalHint, answerHints } = parseHints(completion);
    if (generalHint !== null) {
      return { displayContent: generalHint, hasAnswerHintsOnly: false };
    }
    if (answerHints.length > 0) {
      return { displayContent: null, hasAnswerHintsOnly: true };
    }
    return { displayContent: null, hasAnswerHintsOnly: false };
  }, [completion]);

  const errorMessage =
    retryAfter === null
      ? (error?.message ?? "Nie udało się wygenerować wskazówki.")
      : retryAfter > 0
        ? `Osiągnięto limit podpowiedzi AI. Spróbuj ponownie za ${retryAfter.toString()} s.`
        : "Limit podpowiedzi AI minął. Możesz spróbować ponownie.";

  return (
    <AiCardShell
      title="Wskazówka AI"
      isLoading={isLoading}
      error={error}
      errorMessage={errorMessage}
      retryAfter={retryAfter}
      onRetry={handleStart}
      onStop={stop}
      onClose={onClose}
      emphasized
    >
      {error === undefined &&
      isLoading &&
      displayContent === null &&
      !hasAnswerHintsOnly ? (
        <LoadingDots />
      ) : null}

      {displayContent === null ? null : (
        <div className="text-sm">
          <MarkdownRenderer>{displayContent}</MarkdownRenderer>
        </div>
      )}

      {hasAnswerHintsOnly ? (
        <div className="flex items-center gap-2 py-1">
          <span className="text-muted-foreground text-xs">
            {isLoading
              ? "Generuję wskazówki do odpowiedzi..."
              : "Wskazówki zostały dodane pod odpowiedziami."}
          </span>
        </div>
      ) : null}
    </AiCardShell>
  );
}

interface AiExplanationCardProps {
  defaultAiModel?: string | null;
  question: Question;
  onClose: () => void;
}

export function AiExplanationCard({
  defaultAiModel,
  question,
  onClose,
}: AiExplanationCardProps) {
  const { completion, isLoading, error, retryAfter, handleStart, stop } =
    useQuestionCompletion({
      api: "/ai/explain",
      defaultAiModel,
      question,
      onClose,
    });
  const displayContent = completion.trim();
  const errorMessage =
    retryAfter === null
      ? (error?.message ?? "Nie udało się wygenerować wyjaśnienia.")
      : retryAfter > 0
        ? `Osiągnięto limit wyjaśnień AI. Spróbuj ponownie za ${retryAfter.toString()} s.`
        : "Limit wyjaśnień AI minął. Możesz spróbować ponownie.";

  return (
    <AiCardShell
      title="Wyjaśnienie AI"
      isLoading={isLoading}
      error={error}
      errorMessage={errorMessage}
      retryAfter={retryAfter}
      onRetry={handleStart}
      onStop={stop}
      onClose={onClose}
    >
      {error === undefined && isLoading && displayContent === "" ? (
        <LoadingDots />
      ) : null}

      {displayContent === "" ? null : (
        <div className="text-sm">
          <MarkdownRenderer>{displayContent}</MarkdownRenderer>
        </div>
      )}
    </AiCardShell>
  );
}
