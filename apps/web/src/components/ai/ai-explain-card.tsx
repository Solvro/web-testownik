"use client";

import type { Question } from "@testownik/core/quiz/types";
import { useEffect, useMemo, useRef } from "react";

import {
  AiCardMarkdown,
  AiCardShell,
  LoadingDots,
} from "@/components/ai/ai-card-shell";
import { useQuestionCompletion } from "@/hooks/use-question-completion";

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
        <AiCardMarkdown>{displayContent}</AiCardMarkdown>
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
        <AiCardMarkdown>{displayContent}</AiCardMarkdown>
      )}
    </AiCardShell>
  );
}
