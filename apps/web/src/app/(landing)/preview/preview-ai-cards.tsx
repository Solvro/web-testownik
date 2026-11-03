"use client";

import { useEffect, useEffectEvent, useState } from "react";

import {
  AiCardMarkdown,
  AiCardShell,
  LoadingDots,
} from "@/components/ai/ai-card-shell";
import type { AnswerHint } from "@/components/ai/ai-explain-card";

const THINKING_MS = 520;

/** Thinks for a moment on mount and on `key` change. */
function useCannedLoading(key: string, onLoaded?: () => void) {
  const [loadedRun, setLoadedRun] = useState<string | null>(null);
  const run = key;
  const loaded = useEffectEvent(() => {
    setLoadedRun(run);
    onLoaded?.();
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loaded();
    }, THINKING_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [run]);

  return {
    isLoading: loadedRun !== run,
    stop: () => {
      setLoadedRun(run);
    },
  };
}

export function PreviewAiHintCard({
  hint,
  onClose,
  onAnswerHints,
}: {
  hint: { generalHint: string; answerHints: AnswerHint[] };
  onClose: () => void;
  onAnswerHints?: (hints: AnswerHint[]) => void;
}): React.JSX.Element {
  const { isLoading, stop } = useCannedLoading(
    JSON.stringify(hint),
    onAnswerHints === undefined
      ? undefined
      : () => {
          onAnswerHints(hint.answerHints);
        },
  );

  return (
    <AiCardShell
      title="Wskazówka AI"
      isLoading={isLoading}
      error={undefined}
      errorMessage={undefined}
      retryAfter={null}
      model={null}
      fallback={false}
      onStop={stop}
      onClose={onClose}
      emphasized
    >
      {isLoading ? (
        <LoadingDots />
      ) : (
        <AiCardMarkdown>{hint.generalHint}</AiCardMarkdown>
      )}
    </AiCardShell>
  );
}

export function PreviewAiExplanationCard({
  explanation,
  onClose,
}: {
  explanation: string;
  onClose: () => void;
}): React.JSX.Element {
  const { isLoading, stop } = useCannedLoading(explanation);

  return (
    <AiCardShell
      title="Wyjaśnienie AI"
      isLoading={isLoading}
      error={undefined}
      errorMessage={undefined}
      retryAfter={null}
      model={null}
      fallback={false}
      onStop={stop}
      onClose={onClose}
    >
      {isLoading ? (
        <LoadingDots />
      ) : (
        <AiCardMarkdown>{explanation}</AiCardMarkdown>
      )}
    </AiCardShell>
  );
}
