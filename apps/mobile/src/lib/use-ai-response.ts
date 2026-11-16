import type { Quiz } from "@testownik/core/quiz/types";
import { replaceEqualDeep } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigation } from "expo-router";

import { parseAiHints } from "./ai-hints";
import { ai } from "./api";
import { assistantError } from "./assistant-error";
import { createCompletionAnnouncement } from "./accessibility-feedback";
import { useLocale } from "./locale";
import { consumeAiResponse } from "./ai-response";
import { useQuizAiModel } from "./quiz-ai-model";

type Question = Quiz["questions"][number];

/**
 * Streams the web's AI hint or explanation for a question. Hints use the web's
 * structured contract: one general hint plus optional per-answer hints, where
 * answer numbers follow the order the answers are shown in.
 */
export function useAiResponse(
  inputQuestion: Question,
  mode: "hint" | "explain",
  quizId?: string,
) {
  // Study replaces the outer quiz after a refresh to clear local-copy notices.
  // An identical question must keep its identity so an open stream is not
  // cancelled and sent again. Changed text or answer order still invalidates it.
  const [previousQuestion, setPreviousQuestion] = useState(inputQuestion);
  const [text, setText] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(true);
  const question = replaceEqualDeep(previousQuestion, inputQuestion);
  if (question !== previousQuestion) {
    setPreviousQuestion(question);
    // Never render old answer-index hints against new text or reordered answers.
    setText("");
    setFailure("");
    setBusy(true);
  }
  const { t, language } = useLocale();
  const navigation = useNavigation();
  const selection = useQuizAiModel(quizId);
  const model = useRef(selection.effectiveModel);
  // A background settings refresh can update the next request's model, but must
  // not cancel an in-flight reply and start a second billed request.
  useEffect(() => {
    model.current = selection.effectiveModel;
  }, [selection.effectiveModel]);
  const [client] = useState(() => ai.forSession());
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (selection.isPending) return;
    const controller = new AbortController();
    const announce = createCompletionAnnouncement(controller.signal);
    void (async () => {
      if (selection.error) throw selection.error;
      const request = client.response(`ai/${mode}`, {
        method: "POST",
        // Replies follow the app's language, not the question's.
        body: JSON.stringify({
          question,
          language,
          config: { modelName: model.current },
        }),
        signal: controller.signal,
        timeoutMs: 120000,
      });
      await consumeAiResponse(request, {
        mode,
        answerCount: question.answers.length,
        signal: controller.signal,
        onText: (value) => {
          if (!controller.signal.aborted) setText(value);
        },
        onReady: () => {
          if (navigation.isFocused())
            announce(
              mode === "hint"
                ? t("Wskazówka gotowa", "Hint ready")
                : t("Wyjaśnienie gotowe", "Explanation ready"),
            );
        },
        emptyMessage: t(
          "Nie otrzymaliśmy odpowiedzi. Spróbuj ponownie.",
          "No response received. Please try again.",
        ),
      });
    })()
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure(assistantError(error, t));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [
    question,
    mode,
    attempt,
    t,
    language,
    quizId,
    selection.isPending,
    selection.error,
    client,
    navigation,
  ]);

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
      if (selection.error) void selection.refetch();
    },
  };
}
