import type { Quiz } from "@testownik/core/quiz/types";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { SearchBarCommands } from "react-native-screens";
import { Ionicons } from "@expo/vector-icons";
import StudyImage from "../src/components/StudyImage";
import OptionIndicator from "../src/components/native/OptionIndicator";
import ExternalImageNotice from "../src/components/ExternalImageNotice";
import {
  imageAllowed,
  imageHost,
  isTrustedImage,
} from "../src/lib/image-policy";
import RichText from "../src/components/RichText";
import { StatusContent } from "../src/components/native/StatusView";
import { ErrorState, Field, Label, Screen } from "../src/components/ui";
import { api, API_URL } from "../src/lib/api";
import { ApiError } from "../src/lib/client";
import { useSession } from "../src/lib/session";
import { useLocale } from "../src/lib/locale";
import { useTheme } from "../src/lib/theme";
import { findQuestions, indexQuestions } from "../src/lib/question-search";

export default function SearchQuiz() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  return <QuestionSearch key={`${user?.id}:${id}`} id={id} />;
}
function QuestionSearch({ id }: { id: string }) {
  const s = useSession(),
    { t } = useLocale(),
    c = useTheme();
  const [text, setText] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
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
  const searchBar = useRef<SearchBarCommands>(null);
  const deferred = useDeferredValue(text);
  const q = useQuery({
    queryKey: ["search-quiz", id, s.user?.id],
    enabled: !!id && !!s.library,
    networkMode: "always",
    queryFn: async () => {
      const saved = s.library ? (await s.library.read()).quizzes[id] : null;
      if (s.offline && saved) return saved;
      try {
        return await api.request<Quiz>(`quizzes/${id}/`);
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status))
          throw error;
        if (saved) return saved;
        throw error;
      }
    },
  });
  const index = useMemo(
    () => indexQuestions(q.data?.questions ?? []),
    [q.data?.questions],
  );
  const questions = useMemo(
    () => findQuestions(index, deferred),
    [index, deferred],
  );
  const placeholder = t(
    "Pytanie, odpowiedź lub wyjaśnienie",
    "Question, answer or explanation",
  );
  function clear() {
    setText("");
    searchBar.current?.clearText();
  }
  return (
    <Screen scroll={false}>
      <Stack.Screen
        options={{
          headerStyle: {
            backgroundColor: Platform.OS === "ios" ? "transparent" : c.surface,
          },
          headerSearchBarOptions:
            Platform.OS === "web"
              ? undefined
              : {
                  ref: searchBar,
                  placeholder,
                  autoCapitalize: "none",
                  hideWhenScrolling: false,
                  placement: "automatic",
                  onChangeText: (event) => setText(event.nativeEvent.text),
                  onCancelButtonPress: () => setText(""),
                  onClose: () => setText(""),
                },
        }}
      />
      <FlatList
        data={q.error ? [] : questions}
        keyExtractor={({ question }) => question.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 20,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
          paddingBottom: 40,
        }}
        ListHeaderComponent={
          <View style={{ gap: 8, paddingBottom: 12 }}>
            {Platform.OS === "web" && (
              <Field label={placeholder} value={text} onChangeText={setText} />
            )}
            {q.isLoading ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} />
            ) : q.error ? (
              <ErrorState error={q.error} retry={() => void q.refetch()} />
            ) : questions.length ? (
              <Label muted>
                {t(
                  `Wyniki: ${questions.length}`,
                  `Results: ${questions.length}`,
                )}
              </Label>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !q.isLoading && !q.error ? (
            text.trim() ? (
              <StatusContent
                symbol="magnifyingglass"
                ionicon="search-outline"
                title={t(
                  `Brak wyników dla „${text.trim()}”`,
                  `No Results for “${text.trim()}”`,
                )}
                description={t(
                  "Spróbuj innego słowa. Przeszukujemy też odpowiedzi i wyjaśnienia.",
                  "Try another word. Answers and explanations are included in the search.",
                )}
                actions={[
                  {
                    label: t("Wyczyść wyszukiwanie", "Clear Search"),
                    onPress: clear,
                  },
                ]}
              />
            ) : (
              <StatusContent
                symbol="doc.text"
                ionicon="document-text-outline"
                title={t("Brak pytań", "No Questions Yet")}
                description={t(
                  "Ten quiz nie ma jeszcze pytań.",
                  "This quiz doesn’t have any questions yet.",
                )}
              />
            )
          ) : null
        }
        renderItem={({ item: { question, number }, index }) => {
          const open = expanded === question.id;
          const first = index === 0,
            last = index === questions.length - 1;
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
                accessibilityState={{ expanded: open }}
                accessibilityLabel={t(
                  `Pytanie ${number}: ${question.text || "Pytanie z obrazem"}`,
                  `Question ${number}: ${question.text || "Image question"}`,
                )}
                onPress={() => {
                  searchBar.current?.blur();
                  Keyboard.dismiss();
                  setExpanded((value) =>
                    value === question.id ? null : question.id,
                  );
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 56,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    width: 24,
                    color: c.muted,
                    fontSize: 15,
                    fontVariant: ["tabular-nums"],
                    textAlign: "center",
                  }}
                >
                  {number}
                </Text>
                <Text
                  numberOfLines={open ? undefined : 3}
                  style={{ flex: 1, fontSize: 16, color: c.text }}
                >
                  {question.text || t("Pytanie z obrazem", "Image question")}
                </Text>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={c.muted}
                />
              </Pressable>
              {open && (
                <View style={{ gap: 10, padding: 16, paddingTop: 0 }}>
                  {question.image && images(question.image) ? (
                    <StudyImage
                      key={question.image}
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
                  {question.answers.map((answer) => (
                    <View
                      key={answer.id}
                      accessibilityLabel={[
                        answer.text,
                        answer.is_correct
                          ? t("Poprawna odpowiedź", "Correct answer")
                          : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        padding: 12,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: answer.is_correct ? c.successBg : c.bg,
                      }}
                    >
                      <OptionIndicator
                        multiple={question.multiple}
                        selected={false}
                        result={answer.is_correct ? "correct" : null}
                      />
                      <View style={{ flex: 1, gap: 4 }}>
                        <RichText text={answer.text} allowImages={images} />
                        {answer.image && images(answer.image) ? (
                          <StudyImage
                            key={answer.image}
                            uri={answer.image}
                            height={120}
                            label={t("Ilustracja odpowiedzi", "Answer image")}
                          />
                        ) : null}
                      </View>
                    </View>
                  ))}
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
              )}
            </View>
          );
        }}
      />
    </Screen>
  );
}
