import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import SyncStatus from "../src/components/SyncStatus";
import SavedCopyNotice from "../src/components/SavedCopyNotice";
import OptionIndicator from "../src/components/native/OptionIndicator";
import ResultIcon from "../src/components/native/ResultIcon";
import RichText from "../src/components/RichText";
import StudyImage from "../src/components/StudyImage";
import ExternalImageNotice from "../src/components/ExternalImageNotice";
import { StatusContent } from "../src/components/native/StatusView";
import {
  EmptyState,
  ErrorScreen,
  Label,
  Loading,
  Screen,
} from "../src/components/ui";
import { api, API_URL } from "../src/lib/api";
import { ApiError } from "../src/lib/client";
import {
  imageAllowed,
  imageHost,
  isTrustedImage,
} from "../src/lib/image-policy";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";
import {
  isLocalQuery,
  markLocalQuery,
  isSavedQuery,
  markSavedQuery,
} from "../src/lib/saved-query";
import { useRefreshOnRecovery } from "../src/lib/use-refresh-on-recovery";

export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { t } = useLocale();
  if (typeof id !== "string" || !id.trim())
    return (
      <EmptyState
        symbol="books.vertical"
        ionicon="library-outline"
        title={t("Wybierz quiz", "Choose a Quiz")}
        description={t(
          "Otwórz quiz z biblioteki, aby przejrzeć swoje odpowiedzi.",
          "Open a quiz from the library to review your answers.",
        )}
        actions={[
          {
            label: t("Przeglądaj bibliotekę", "Browse Library"),
            onPress: () => router.navigate("/library"),
          },
        ]}
      />
    );
  return <AnswerHistory key={`${user?.id}:${id}`} id={id} />;
}
function AnswerHistory({ id }: { id: string }) {
  const [client] = useState(() => api.forSession());
  const cache = useQueryClient();
  const s = useSession(),
    c = useTheme(),
    { t, language } = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approvedHosts, setApprovedHosts] = useState<string[]>([]);
  const images = useCallback(
    (url: string) =>
      imageAllowed(
        url,
        (value) =>
          isTrustedImage(value, API_URL) ||
          approvedHosts.includes(imageHost(value) ?? ""),
      ),
    [approvedHosts],
  );
  const q = useQuery({
    queryKey: ["answer-history", id, s.user?.id],
    enabled: !!id && !!s.library,
    networkMode: "always",
    // Symbol metadata must be replaced even when server fields are identical.
    structuralSharing: false,
    queryFn: async ({ signal }) => {
      const state = await s.library!.read();
      const saved = state.quizzes[id];
      const previous = cache.getQueryData<QuizWithUserProgress>([
        "answer-history",
        id,
        s.user?.id,
      ]);
      if (
        saved &&
        (s.offline || state.queue.some((item) => item.quiz_id === id))
      )
        return isSavedQuery(previous)
          ? markSavedQuery(saved)
          : markLocalQuery(saved);
      const snapshot = s.library!.captureSnapshot(id, state);
      try {
        const fresh = await client.request<QuizWithUserProgress>(
          `quizzes/${id}/?include=current_session`,
          { signal, timeoutMs: saved ? 4000 : undefined },
        );
        // Local answers may have synchronized while this GET was in flight.
        const latestState = await s.library!.read();
        if (!s.library!.matchesSnapshot(id, snapshot, latestState)) {
          const latest = latestState.quizzes[id];
          if (latest)
            return isSavedQuery(previous)
              ? markSavedQuery(latest)
              : markLocalQuery(latest);
        }
        return fresh;
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof ApiError && [401, 403, 404].includes(error.status))
          throw error;
        const latest = (await s.library!.read()).quizzes[id];
        if (latest) return markSavedQuery(latest);
        throw error;
      }
    },
  });
  useRefreshOnRecovery({
    scope: `${s.user?.id}:${id}`,
    offline: s.offline,
    pending: s.pending,
    local: isLocalQuery(q.data),
    enabled: !!s.library && !q.isFetching,
    refresh: q.refetch,
  });
  const questions = useMemo(
    () =>
      new Map(
        q.data?.questions.map((question, index) => [
          question.id,
          { question, number: index + 1 },
        ]),
      ),
    [q.data?.questions],
  );
  const answers = useMemo(
    () =>
      [...(q.data?.current_session?.answers ?? [])].sort(
        (a, b) =>
          (Date.parse(b.answered_at) || 0) - (Date.parse(a.answered_at) || 0),
      ),
    [q.data?.current_session?.answers],
  );
  if (q.isLoading) return <Loading />;
  if (q.error)
    return <ErrorScreen error={q.error} retry={() => void q.refetch()} />;
  const correct = answers.filter((answer) => answer.was_correct).length;
  return (
    <Screen scroll={false}>
      <FlatList
        data={answers}
        keyExtractor={(answer) => answer.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View style={{ gap: 4, paddingBottom: 12 }}>
            <SyncStatus />
            {isSavedQuery(q.data) &&
            !s.offline &&
            !s.pending &&
            !s.syncError ? (
              <SavedCopyNotice retry={q.refetch} disabled={q.isFetching} />
            ) : null}
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
              {q.data?.title}
            </Text>
            {answers.length ? (
              <Label muted>
                {t(
                  `Bieżąca sesja · ${correct} z ${answers.length} poprawnie`,
                  `Current session · ${correct} of ${answers.length} correct`,
                )}
              </Label>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <StatusContent
            symbol="clock.arrow.circlepath"
            ionicon="time-outline"
            title={t("Jeszcze bez odpowiedzi", "No Answers Yet")}
            description={t(
              "Sprawdzone odpowiedzi pojawią się tutaj, także podczas nauki offline.",
              "Checked answers appear here, including while studying offline.",
            )}
          />
        }
        renderItem={({ item, index }) => {
          const entry = questions.get(item.question),
            question = entry?.question;
          const open = expanded === item.id;
          const first = index === 0,
            last = index === answers.length - 1;
          const result = item.was_correct
            ? t("Poprawnie", "Correct")
            : t("Niepoprawnie", "Incorrect");
          const title =
            question?.text ||
            (question
              ? t("Pytanie z obrazem", "Image question")
              : t("Pytanie niedostępne", "Question unavailable"));
          const when = Number.isFinite(Date.parse(item.answered_at))
            ? new Date(item.answered_at).toLocaleString(
                language === "pl" ? "pl-PL" : "en-GB",
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )
            : null;
          return (
            <View
              style={{
                backgroundColor: c.surface,
                borderTopLeftRadius: first ? 14 : 0,
                borderTopRightRadius: first ? 14 : 0,
                borderBottomLeftRadius: last ? 14 : 0,
                borderBottomRightRadius: last ? 14 : 0,
                borderCurve: "continuous",
              }}
            >
              {first ? null : (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: c.border,
                    marginLeft: 52,
                  }}
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={[
                  `${result}: ${title}`,
                  entry
                    ? t(`Pytanie ${entry.number}`, `Question ${entry.number}`)
                    : null,
                  when,
                ]
                  .filter(Boolean)
                  .join(", ")}
                accessibilityState={{ expanded: open }}
                onPress={() => setExpanded(open ? null : item.id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 60,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <ResultIcon
                  result={item.was_correct ? "correct" : "wrong"}
                  size={24}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  {open && question ? null : (
                    <Text
                      numberOfLines={2}
                      style={{ color: c.text, fontSize: 16 }}
                    >
                      {title}
                    </Text>
                  )}
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {[
                      entry
                        ? t(
                            `Pytanie ${entry.number}`,
                            `Question ${entry.number}`,
                          )
                        : null,
                      when,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={c.muted}
                />
              </Pressable>
              {open &&
                (question ? (
                  <View style={{ gap: 10, padding: 16, paddingTop: 0 }}>
                    <RichText text={question.text} allowImages={images} />
                    {question.image && images(question.image) ? (
                      <StudyImage
                        uri={question.image}
                        label={t("Ilustracja pytania", "Question image")}
                      />
                    ) : null}
                    <ExternalImageNotice
                      question={question}
                      showExplanation
                      allowed={images}
                      approve={(hosts) =>
                        setApprovedHosts((previous) => [
                          ...new Set([...previous, ...hosts]),
                        ])
                      }
                    />
                    {!item.selected_answers.length ? (
                      <Label muted>
                        {t(
                          "Nie zapisano wybranych odpowiedzi dla tego wpisu.",
                          "No answer choices were recorded for this entry.",
                        )}
                      </Label>
                    ) : null}
                    {question.answers.map((answer) => {
                      const selected = item.selected_answers.includes(
                        answer.id,
                      );
                      const wrong = selected && !answer.is_correct;
                      return (
                        <View
                          key={answer.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            padding: 12,
                            borderRadius: 12,
                            borderCurve: "continuous",
                            backgroundColor: answer.is_correct
                              ? c.successBg
                              : wrong
                                ? c.dangerBg
                                : c.bg,
                          }}
                        >
                          <View
                            accessible={answer.is_correct || wrong}
                            accessibilityRole="text"
                            accessibilityLabel={[
                              answer.is_correct
                                ? t("Poprawna odpowiedź", "Correct answer")
                                : t(
                                    "Niepoprawna odpowiedź",
                                    "Incorrect answer",
                                  ),
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          >
                            <View
                              accessibilityElementsHidden
                              importantForAccessibility="no-hide-descendants"
                            >
                              <OptionIndicator
                                multiple={question.multiple}
                                selected={selected}
                                result={
                                  answer.is_correct
                                    ? "correct"
                                    : wrong
                                      ? "wrong"
                                      : null
                                }
                              />
                            </View>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <RichText text={answer.text} allowImages={images} />
                            {answer.image && images(answer.image) ? (
                              <StudyImage
                                uri={answer.image}
                                height={120}
                                label={t(
                                  "Ilustracja odpowiedzi",
                                  "Answer image",
                                )}
                              />
                            ) : null}
                            {selected ? (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: answer.is_correct
                                    ? c.success
                                    : c.danger,
                                }}
                              >
                                {t("Twój wybór", "Your choice")}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                    {question.explanation ? (
                      <View style={{ gap: 4, paddingTop: 4 }}>
                        <Text
                          style={{
                            color: c.text,
                            fontSize: 15,
                            fontWeight: "600",
                          }}
                        >
                          {t("Wyjaśnienie", "Explanation")}
                        </Text>
                        <RichText
                          text={question.explanation}
                          allowImages={images}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ padding: 16, paddingTop: 0 }}>
                    <Label muted>
                      {t(
                        "To pytanie mogło zostać usunięte z quizu. Zachowaliśmy wynik odpowiedzi.",
                        "This question may have been removed from the quiz. Your answer result is retained.",
                      )}
                    </Label>
                  </View>
                ))}
            </View>
          );
        }}
      />
    </Screen>
  );
}
