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

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  buildExplainCheckedPrompt,
  buildExplainCheckedUserMessage,
  buildExplainUncheckedPrompt,
  buildExplainUncheckedUserMessage,
  collectQuestionImages,
} from "@/lib/ai/prompts";
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

interface AiExplainCardProps {
  question: Question;
  questionChecked: boolean;
  onClose: () => void;
  onAnswerHints?: (hints: AnswerHint[]) => void;
}

export function AiExplainCard({
  question,
  questionChecked,
  onClose,
  onAnswerHints,
}: AiExplainCardProps) {
  const startedRef = useRef(false);
  // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
  const previousQuestionId = useRef(question.id);
  const lastHintsRef = useRef<string>("");
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const system = useMemo(
    () =>
      questionChecked
        ? buildExplainCheckedPrompt(question)
        : buildExplainUncheckedPrompt(question),
    [question, questionChecked],
  );

  const prompt = useMemo(
    () =>
      questionChecked
        ? buildExplainCheckedUserMessage(question)
        : buildExplainUncheckedUserMessage(question),
    [question, questionChecked],
  );

  const images = useMemo(() => collectQuestionImages(question), [question]);

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
    api: "/ai/explain",
    streamProtocol: "text",
    fetch: fetchWithRateLimitHandling,
    onError: () => {
      startedRef.current = false;
    },
  });

  const startCompletion = useCallback(() => {
    setRetryAfter(null);
    startedRef.current = true;
    void complete(prompt, { body: { system, images } });
  }, [complete, prompt, system, images]);

  const handleStart = useCallback(() => {
    if (retryAfter !== null && retryAfter > 0) {
      return;
    }
    startCompletion();
  }, [retryAfter, startCompletion]);

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(() => {
    if (previousQuestionId.current !== question.id) {
      previousQuestionId.current = question.id;
      onClose();
    }
  }, [question.id, onClose]);
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

  /* eslint-disable react-you-might-not-need-an-effect/no-derived-state */
  useEffect(() => {
    if (!startedRef.current) {
      startCompletion();
    }
  }, [startCompletion]);
  /* eslint-enable react-you-might-not-need-an-effect/no-derived-state */

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

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-data-to-parent */
  useEffect(() => {
    if (!questionChecked && completion !== "" && onAnswerHints !== undefined) {
      const { answerHints } = parseHints(completion);
      const hintsKey = JSON.stringify(answerHints);
      if (answerHints.length > 0 && hintsKey !== lastHintsRef.current) {
        lastHintsRef.current = hintsKey;
        onAnswerHints(answerHints);
      }
    }
  }, [completion, questionChecked, onAnswerHints]);
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-data-to-parent */

  const { displayContent, hasAnswerHintsOnly } = useMemo(() => {
    if (questionChecked) {
      const stripped = completion
        .replaceAll(/<\/?(?:general_hint|answer_hints|hint[^>]*)>/g, "")
        .trim();
      return {
        displayContent: stripped === "" ? null : stripped,
        hasAnswerHintsOnly: false,
      };
    }
    const { generalHint, answerHints: parsed } = parseHints(completion);
    if (generalHint !== null) {
      return { displayContent: generalHint, hasAnswerHintsOnly: false };
    }
    if (parsed.length > 0) {
      return { displayContent: null, hasAnswerHintsOnly: true };
    }
    return { displayContent: null, hasAnswerHintsOnly: false };
  }, [completion, questionChecked]);

  const title = questionChecked ? "Wyjaśnienie AI" : "Wskazówka AI";
  const errorMessage =
    retryAfter === null
      ? error?.message
      : retryAfter > 0
        ? `Osiągnięto limit podpowiedzi AI. Spróbuj ponownie za ${retryAfter.toString()} s.`
        : "Limit podpowiedzi AI minął. Możesz spróbować ponownie.";

  return (
    <Card
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
        !questionChecked &&
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
                onClick={stop}
                aria-label="Zatrzymaj"
              >
                <SquareIcon className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleStart}
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
        {error === undefined ? (
          isLoading && displayContent === null && !hasAnswerHintsOnly ? (
            <LoadingDots />
          ) : null
        ) : (
          <div className="flex items-center gap-3 py-2">
            <AlertCircleIcon className="text-destructive size-4 shrink-0" />
            <span className="text-muted-foreground text-xs">
              {errorMessage ??
                `Nie udało się wygenerować ${
                  questionChecked ? "wyjaśnienia" : "wskazówki"
                }.`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStart}
              disabled={retryAfter !== null && retryAfter > 0}
              className="ml-auto"
            >
              <RefreshCwIcon className="size-3" />
              Ponów
            </Button>
          </div>
        )}

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
      </CardContent>
    </Card>
  );
}
