import type { Quiz } from "@testownik/core/quiz/types";
import { useEffect, useState } from "react";

import { parseAiHints } from "./ai-hints";
import { ai } from "./api";
import { assistantError } from "./assistant-error";
import { useLocale } from "./locale";
import { consumeText } from "./stream";

type Question = Quiz["questions"][number];

/**
 * Streams the web's AI hint or explanation for a question. Hints use the web's
 * structured contract: one general hint plus optional per-answer hints, where
 * answer numbers follow the order the answers are shown in.
 */
export function useAiResponse(question: Question, mode: "hint" | "explain") {
  const { t, language } = useLocale();
  const [text, setText] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const response = await ai.response(`ai/${mode}`, {
        method: "POST",
        // Replies follow the app's language, not the question's.
        body: JSON.stringify({ question, language }),
        signal: controller.signal,
      });
      let result = "";
      await consumeText(
        response,
        (value) => {
          result = value;
          if (!controller.signal.aborted) setText(value);
        },
        false,
        controller.signal,
      );
      if (
        !result.trim() ||
        (mode === "hint" &&
          !parseAiHints(result, question.answers.length).length)
      )
        throw new Error(
          t(
            "Nie otrzymaliśmy odpowiedzi. Spróbuj ponownie.",
            "No response received. Please try again.",
          ),
        );
    })()
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure(assistantError(error, t));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [question, mode, attempt, t, language]);

  const blocks =
    mode === "hint"
      ? parseAiHints(text, question.answers.length)
      : text
        ? [{ key: "explanation", text, answerIndex: undefined }]
        : [];
  return {
    busy,
    failure,
    general: blocks.filter((block) => block.answerIndex === undefined),
    answers: new Map(
      blocks
        .filter((block) => block.answerIndex !== undefined)
        .map((block) => [block.answerIndex!, block.text]),
    ),
    retry: () => {
      setText("");
      setFailure("");
      setBusy(true);
      setAttempt((n) => n + 1);
    },
  };
}
