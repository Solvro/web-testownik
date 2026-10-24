"use client";

import { useEffect, useEffectEvent, useState } from "react";

import {
  AiCardMarkdown,
  AiCardShell,
  LoadingDots,
} from "@/components/ai/ai-card-shell";
import type { AnswerHint } from "@/components/ai/ai-explain-card";

/** How long the canned cards "think" before showing their content. */
const THINKING_MS = 520;

/** Thinks for a moment on mount, on `key` change and on retry. */
function useCannedLoading(key: string, onLoaded?: () => void) {
  const [runId, setRunId] = useState(0);
  const [loadedRun, setLoadedRun] = useState<string | null>(null);
  const run = `${runId.toString()}:${key}`;
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
    retry: () => {
      setRunId((current) => current + 1);
    },
    stop: () => {
      setLoadedRun(run);
    },
  };
}

/** The quiz page's AI hint card with canned content instead of `/ai/hint`. */
export function PreviewAiHintCard({
  hint,
  onClose,
  onAnswerHints,
}: {
  hint: { generalHint: string; answerHints: AnswerHint[] };
  onClose: () => void;
  onAnswerHints?: (hints: AnswerHint[]) => void;
}): React.JSX.Element {
  const { isLoading, retry, stop } = useCannedLoading(
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
      onRetry={retry}
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

/** The quiz page's AI explanation card with canned content instead of `/ai/explain`. */
export function PreviewAiExplanationCard({
  explanation,
  onClose,
}: {
  explanation: string;
  onClose: () => void;
}): React.JSX.Element {
  const { isLoading, retry, stop } = useCannedLoading(explanation);

  return (
    <AiCardShell
      title="Wyjaśnienie AI"
      isLoading={isLoading}
      error={undefined}
      errorMessage={undefined}
      retryAfter={null}
      model={null}
      fallback={false}
      onRetry={retry}
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
