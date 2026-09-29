import type { Quiz } from "@testownik/core/quiz/types";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import RichText from "../src/components/RichText";
import { Button, ErrorState, Label, Screen } from "../src/components/ui";
import { ai, api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { consumeText } from "../src/lib/stream";
import { useLocale } from "../src/lib/locale";
import { UserFacingError } from "../src/lib/user-error";

export default function Hint() {
  const { t } = useLocale();
  const {
    id,
    question: questionId,
    mode,
  } = useLocalSearchParams<{ id: string; question: string; mode: string }>();
  const { library } = useSession();
  const [text, setText] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const cached = await library?.read();
      const quiz =
        cached?.quizzes[id] ??
        (await api.request<Quiz>(`quizzes/${id}/`, {
          signal: controller.signal,
        }));
      const question = quiz.questions.find((item) => item.id === questionId);
      if (!question) throw new UserFacingError("missingQuestion");
      const response = await ai.response(
        mode === "explain" ? "ai/explain" : "ai/hint",
        {
          method: "POST",
          body: JSON.stringify({ question }),
          signal: controller.signal,
        },
      );
      await consumeText(
        response,
        (value) => {
          if (!controller.signal.aborted) setText(value);
        },
        false,
      );
    })().catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure);
    });
    return () => controller.abort();
  }, [id, questionId, mode, library, attempt]);
  return (
    <Screen
      footer={
        <Button kind="secondary" onPress={() => router.back()}>
          {t("Wróć do pytania", "Back to Question")}
        </Button>
      }
    >
      <Stack.Screen
        options={{
          title:
            mode === "explain"
              ? t("Wyjaśnienie AI", "AI Explanation")
              : t("Podpowiedź AI", "AI Hint"),
        }}
      />
      {error ? (
        <ErrorState
          error={error}
          retry={() => {
            setError(null);
            setText("");
            setAttempt((n) => n + 1);
          }}
        />
      ) : text ? (
        <RichText text={text} />
      ) : (
        <Label>
          {mode === "explain"
            ? t("Przygotowuję wyjaśnienie…", "Preparing an explanation…")
            : t("Przygotowuję podpowiedź…", "Preparing a hint…")}
        </Label>
      )}
      <Label muted>
        {t(
          "AI może się mylić. Sprawdzaj odpowiedzi w materiałach do zajęć.",
          "AI can make mistakes. Check answers against your course materials.",
        )}
      </Label>
    </Screen>
  );
}
