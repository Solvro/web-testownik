import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RatingControl from "../src/components/RatingControl";
import ChatAction from "../src/components/native/ChatAction";
import { ErrorScreen, ErrorState, Label } from "../src/components/ui";
import { notify, useConfirm } from "../src/lib/alerts";
import { api, listOf } from "../src/lib/api";
import { haptics } from "../src/lib/haptics";
import { useLocale } from "../src/lib/locale";
import { useQuizRating } from "../src/lib/quiz-rating";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";
import { userError } from "../src/lib/user-error";

interface Comment {
  id: string;
  content: string;
  author: { id: string; full_name: string } | null;
  created_at: string;
  /** Deleted comments stay in the thread (for replies) with no content. */
  is_deleted?: boolean;
}

export default function Community() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  return <Reviews key={`${user?.id}:${id}`} id={id} />;
}

function Reviews({ id }: { id: string }) {
  const { t, language } = useLocale();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const s = useSession(),
    [content, setContent] = useState(""),
    [posting, setPosting] = useState(false);
  const { mine, current, state: ratingState, rate } = useQuizRating(id);
  const comments = useQuery({
    queryKey: ["comments", id, s.user?.id],
    queryFn: async () =>
      listOf(await api.request<Comment[]>(`comments/?quiz=${id}`)).filter(
        (comment) => !comment.is_deleted,
      ),
  });

  async function post() {
    const submitted = content.trim();
    if (!submitted || posting) return;
    setPosting(true);
    try {
      await api.post("comments/", { quiz: id, content: submitted });
      setContent((value) => (value.trim() === submitted ? "" : value));
      haptics.success();
      await comments.refetch();
    } catch (error) {
      notify(
        t("Nie dodano komentarza", "Couldn’t Post Comment"),
        userError(error, t),
      );
    } finally {
      setPosting(false);
    }
  }

  // Both failing means the connection or server is down: say it once.
  if (mine.error && comments.error && !comments.data)
    return (
      <ErrorScreen
        error={comments.error}
        retry={() => {
          void mine.refetch();
          void comments.refetch();
        }}
      />
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          padding: 20,
          gap: 12,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: 16,
            borderCurve: "continuous",
            paddingVertical: 16,
            paddingHorizontal: 12,
            gap: 6,
            alignItems: "center",
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: c.text, fontSize: 17, fontWeight: "600" }}
          >
            {t("Oceń ten quiz", "Rate This Quiz")}
          </Text>
          <RatingControl
            value={current?.score ?? 0}
            onChange={(score) => void rate(score)}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: ratingState === "error" ? c.danger : c.muted,
              fontSize: 13,
            }}
          >
            {mine.isPending
              ? t("Wczytywanie…", "Loading…")
              : ratingState === "saving"
                ? t("Zapisywanie…", "Saving…")
                : ratingState === "error"
                  ? t(
                      "Nie zapisano oceny. Dotknij gwiazdki ponownie.",
                      "Rating not saved. Tap a star to try again.",
                    )
                  : current
                    ? t(
                        `Twoja ocena: ${current.score}/5`,
                        `Your rating: ${current.score}/5`,
                      )
                    : t("Dotknij gwiazdki, aby ocenić", "Tap a star to rate")}
          </Text>
          {mine.error ? (
            <ErrorState error={mine.error} retry={() => void mine.refetch()} />
          ) : null}
        </View>

        <Text
          accessibilityRole="header"
          style={{
            color: c.text,
            fontSize: 20,
            fontWeight: "600",
            paddingTop: 12,
            paddingHorizontal: 4,
          }}
        >
          {t("Komentarze", "Comments")}
        </Text>
        {comments.isPending ? (
          <ActivityIndicator
            accessibilityLabel={t("Wczytywanie komentarzy", "Loading comments")}
          />
        ) : null}
        {comments.error ? (
          <ErrorState
            error={comments.error}
            retry={() => void comments.refetch()}
          />
        ) : null}
        {comments.data?.length === 0 && !comments.error ? (
          <Label muted>
            {t(
              "Nie ma jeszcze komentarzy. Podziel się wskazówką do nauki.",
              "No comments yet. Share a study tip.",
            )}
          </Label>
        ) : null}
        {comments.data?.length ? (
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: 16,
              borderCurve: "continuous",
              overflow: "hidden",
            }}
          >
            {comments.data.map((comment, index) => {
              const own = comment.author?.id === s.user?.id;
              return (
                <View key={comment.id}>
                  {index ? (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: c.border,
                        marginLeft: 16,
                      }}
                    />
                  ) : null}
                  <View style={{ padding: 16, gap: 4 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          color: c.text,
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        {comment.author?.full_name ??
                          t("Usunięte konto", "Deleted account")}
                      </Text>
                      <Text style={{ color: c.muted, fontSize: 13 }}>
                        {new Date(comment.created_at).toLocaleDateString(
                          language === "pl" ? "pl-PL" : "en-GB",
                          { day: "numeric", month: "short" },
                        )}
                      </Text>
                      {own ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            "Usuń komentarz",
                            "Delete comment",
                          )}
                          hitSlop={10}
                          onPress={() =>
                            confirm(
                              t("Usunąć komentarz?", "Delete Comment?"),
                              t(
                                "Treść komentarza zostanie ukryta.",
                                "The comment will be hidden.",
                              ),
                              async () => {
                                await api.delete(`comments/${comment.id}/`);
                                await comments.refetch();
                              },
                              { action: t("Usuń", "Delete") },
                            )
                          }
                        >
                          <Ionicons
                            name="trash-outline"
                            size={17}
                            color={c.muted}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text
                      selectable
                      style={{ color: c.text, fontSize: 16, lineHeight: 22 }}
                    >
                      {comment.content}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          backgroundColor: c.bg,
        }}
      >
        <TextInput
          value={content}
          onChangeText={setContent}
          multiline
          placeholder={t("Dodaj komentarz…", "Add a comment…")}
          accessibilityLabel={t("Twój komentarz", "Your comment")}
          placeholderTextColor={c.muted}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 140,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            borderRadius: 22,
            backgroundColor: c.surface,
            color: c.text,
            fontSize: 16,
          }}
        />
        <ChatAction
          label={t("Wyślij komentarz", "Post comment")}
          stopping={false}
          disabled={!content.trim() || posting}
          onPress={() => void post()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
