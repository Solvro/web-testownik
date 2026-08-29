"use client";

import {
  AlertCircleIcon,
  Clock3Icon,
  LifeBuoyIcon,
  RefreshCwIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAIModels } from "@/hooks/use-ai-models";
import { useQuestionCompletion } from "@/hooks/use-question-completion";
import { getAiModelMetadata } from "@/lib/ai/models";
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
    <div className="flex items-center gap-2 py-1">
      <span className="text-muted-foreground text-xs">Myślę</span>
      <span className="flex gap-1">
        <span className="bg-primary/50 size-1.5 animate-pulse rounded-full" />
        <span className="bg-primary/50 size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
        <span className="bg-primary/50 size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
      </span>
    </div>
  );
}

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
  retryDisabled = false,
  cooldown = false,
  model,
  fallback,
}: {
  title: string;
  isLoading: boolean;
  error: Error | undefined;
  errorMessage: string | undefined;
  retryAfter: number | null;
  retryDisabled?: boolean;
  cooldown?: boolean;
  model: string | null;
  fallback: boolean;
  onRetry: () => void;
  onStop: () => void;
  onClose: () => void;
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  const retryBlocked = retryDisabled || (retryAfter !== null && retryAfter > 0);
  const { data: aiModels } = useAIModels();
  const modelMetadata =
    model === null
      ? null
      : getAiModelMetadata(
          [
            ...(aiModels?.models ?? []),
            ...(aiModels?.fallback_model === null ||
            aiModels?.fallback_model === undefined
              ? []
              : [aiModels.fallback_model]),
          ],
          model,
        );
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
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
            <div className="bg-primary/10 flex size-6 items-center justify-center rounded-full">
              <SparklesIcon
                className={cn(
                  "text-primary size-3.5",
                  isLoading && "animate-pulse",
                )}
              />
            </div>
            <span>{title}</span>
            {model === null ? null : (
              <Badge variant="secondary" className="max-w-44 font-normal">
                {modelMetadata === null ? null : (
                  <AiModelProviderIcon
                    provider={modelMetadata.provider}
                    className="size-3"
                  />
                )}
                <span className="truncate">
                  {modelMetadata?.label ?? model}
                </span>
              </Badge>
            )}
            {model !== null && fallback ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Model zapasowy"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
                    />
                  }
                >
                  <LifeBuoyIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  Model zapasowy używany po wykorzystaniu głównej puli.
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {isLoading ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-10 sm:size-8"
                onClick={onStop}
                aria-label="Zatrzymaj"
              >
                <SquareIcon className="size-3 fill-current" />
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={retryBlocked ? undefined : onRetry}
                      aria-disabled={retryBlocked}
                      aria-label="Wygeneruj ponownie"
                      className="size-10 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 sm:size-8"
                    />
                  }
                >
                  <RefreshCwIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  {retryBlocked ? errorMessage : "Wygeneruj ponownie"}
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-10 sm:size-8"
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
          <div
            role="status"
            className={cn(
              "flex items-center gap-2.5 py-2 text-xs",
              cooldown ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {cooldown ? (
              <Clock3Icon className="size-4 shrink-0" />
            ) : (
              <AlertCircleIcon className="size-4 shrink-0" />
            )}
            <span className="font-medium tabular-nums">{errorMessage}</span>
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
  const {
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
  } = useQuestionCompletion({
    api: "/ai/hint",
    defaultAiModel,
    question,
    onClose,
  });
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-data-to-parent */
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
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-data-to-parent */

  const handleRegenerate = () => {
    lastHintsRef.current = "";
    onAnswerHints?.([]);
    handleStart();
  };

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
    quotaResetAt === null
      ? retryAfter === null
        ? (error?.message ?? "Nie udało się wygenerować wskazówki.")
        : retryAfter > 0
          ? `Osiągnięto limit podpowiedzi AI. Spróbuj ponownie za ${retryAfter.toString()} s.`
          : "Limit podpowiedzi AI minął. Możesz spróbować ponownie."
      : `Następna próba: ${quotaResetLabel ?? "wkrótce"}.`;

  return (
    <AiCardShell
      title="Wskazówka AI"
      isLoading={isLoading}
      error={error}
      errorMessage={errorMessage}
      retryAfter={retryAfter}
      retryDisabled={quotaResetAt !== null}
      cooldown={quotaResetAt !== null || retryAfter !== null}
      model={servedModel}
      fallback={fallbackModel !== null}
      onRetry={handleRegenerate}
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
              ? "Generuję wskazówki do odpowiedzi…"
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
  const {
    completion,
    isLoading,
    error,
    retryAfter,
    quotaResetAt,
    quotaResetLabel,
    servedModel,
    fallbackModel,
    handleStart,
    stop,
  } = useQuestionCompletion({
    api: "/ai/explain",
    defaultAiModel,
    question,
    onClose,
  });
  const displayContent = completion.trim();
  const errorMessage =
    quotaResetAt === null
      ? retryAfter === null
        ? (error?.message ?? "Nie udało się wygenerować wyjaśnienia.")
        : retryAfter > 0
          ? `Osiągnięto limit wyjaśnień AI. Spróbuj ponownie za ${retryAfter.toString()} s.`
          : "Limit wyjaśnień AI minął. Możesz spróbować ponownie."
      : `Następna próba: ${quotaResetLabel ?? "wkrótce"}.`;

  return (
    <AiCardShell
      title="Wyjaśnienie AI"
      isLoading={isLoading}
      error={error}
      errorMessage={errorMessage}
      retryAfter={retryAfter}
      retryDisabled={quotaResetAt !== null}
      cooldown={quotaResetAt !== null || retryAfter !== null}
      model={servedModel}
      fallback={fallbackModel !== null}
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
