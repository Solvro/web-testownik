import type { Quiz } from "@testownik/core/quiz/types";
import { useQuery } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import RichText from "../src/components/RichText";
import InlineHint, { AnswerHint } from "../src/components/InlineHint";
import { Button, ErrorState, Loading, Screen } from "../src/components/ui";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { useLocale } from "../src/lib/locale";
import { UserFacingError } from "../src/lib/user-error";
import { useAiResponse } from "../src/lib/use-ai-response";

export default function Hint() {
  const { t } = useLocale();
  const {
    id,
    question: questionId,
    mode,
  } = useLocalSearchParams<{
    id: string;
    question: string;
    mode: string;
  }>();
  const { library, user } = useSession();
  const [client] = useState(() => api.forSession());
  const query = useQuery({
    queryKey: ["hint-question", user?.id, id, questionId],
    networkMode: "always",
    queryFn: async ({ signal }) => {
      if (
        typeof id !== "string" ||
        !id ||
        id === "." ||
        id === ".." ||
        typeof questionId !== "string" ||
        !questionId
      )
        throw new UserFacingError("missingQuestion");
      const cached = await library?.read();
      const saved =
        cached && Object.hasOwn(cached.quizzes, id)
          ? cached.quizzes[id]
          : undefined;
      const savedQuestion = saved?.questions.find(
        (item) => item.id === questionId,
      );
      if (savedQuestion) return savedQuestion;
      const quiz = await client.request<Quiz>(
        `quizzes/${encodeURIComponent(id)}/`,
        { signal },
      );
      if (!Array.isArray(quiz?.questions))
        throw new UserFacingError("missingQuestion");
      const question = quiz.questions.find((item) => item.id === questionId);
      if (!question) throw new UserFacingError("missingQuestion");
      return question;
    },
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <Screen
      footer={
        <Button kind="secondary" onPress={back}>
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
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        <HintResponse
          key={`${user?.id}:${id}:${questionId}:${mode}`}
          question={query.data}
          quizId={id}
          mode={mode === "explain" ? "explain" : "hint"}
          onClose={back}
        />
      ) : null}
    </Screen>
  );
}

function HintResponse({
  question,
  quizId,
  mode,
  onClose,
}: {
  question: Quiz["questions"][number];
  quizId: string;
  mode: "hint" | "explain";
  onClose: () => void;
}) {
  const response = useAiResponse(question, mode, quizId);
  return (
    <View style={{ gap: 12 }}>
      <RichText text={question.text} />
      {response.answers.size
        ? question.answers.map((answer, index) => (
            <View key={answer.id} style={{ gap: 4 }}>
              <RichText text={answer.text} />
              {response.answers.get(index) ? (
                <AnswerHint
                  text={response.answers.get(index)!}
                  streaming={response.busy}
                />
              ) : null}
            </View>
          ))
        : null}
      <InlineHint mode={mode} state={response} onClose={onClose} />
    </View>
  );
}
