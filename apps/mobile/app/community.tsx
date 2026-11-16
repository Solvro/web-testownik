import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
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
import { tokenStore } from "../src/lib/storage";
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
  const [session] = useState(() => tokenStore.session());
  const [client] = useState(() => api.forSession(session));
  const { t, language } = useLocale();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const s = useSession(),
    [content, setContent] = useState(""),
    [posting, setPosting] = useState(false),
    [deletingId, setDeletingId] = useState<string | null>(null);
  const cache = useQueryClient();
  const postingRef = useRef(false);
  const [postedNotice, setPostedNotice] = useState(false);
  const commentsKey = ["comments", id, s.user?.id];
  const { mine, current, state: ratingState, rate } = useQuizRating(id);
  const comments = useQuery({
    queryKey: commentsKey,
    networkMode: "always",
    queryFn: async ({ signal }) =>
      listOf(
        await client.request<Comment[]>(`comments/?quiz=${id}`, { signal }),
      ).filter((comment) => !comment.is_deleted),
  });

  async function post() {
    const submitted = content.trim();
    if (!submitted || postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    try {
      const saved = await client.post<Comment>("comments/", {
        quiz: id,
        content: submitted,
      });
      await cache.cancelQueries({ queryKey: commentsKey, exact: true });
      if (session.aborted) return;
      // An accepted write is complete even when a later list refresh fails.
      // Keep an unknown thread unknown; the receipt still confirms the post.
      setPostedNotice(cache.getQueryData(commentsKey) === undefined);
      cache.setQueryData<Comment[]>(commentsKey, (previous) =>
        previous
          ? [saved, ...previous.filter((item) => item.id !== saved.id)]
          : undefined,
      );
      setContent((value) => (value.trim() === submitted ? "" : value));
      haptics.success();
      void cache.invalidateQueries({ queryKey: commentsKey, exact: true });
    } catch (error) {
      if (session.aborted) return;
      void cache.invalidateQueries({ queryKey: commentsKey, exact: true });
      notify(
        t("Nie dodano komentarza", "Couldn’t Post Comment"),
        userError(error, t),
      );
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  // Both failing means the connection or server is down: say it once.
  if (mine.error && comments.error && !comments.data && !postedNotice)
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
        keyboardShouldPersistTaps="handled"
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
            disabled={mine.data === undefined || ratingState === "saving"}
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
        {postedNotice && comments.data === undefined ? (
          <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>
            {t("Komentarz został dodany.", "Comment posted.")}
          </Text>
        ) : null}
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
                          accessibilityHint={comment.content}
                          disabled={deletingId !== null}
                          style={{
                            opacity:
                              deletingId !== null && deletingId !== comment.id
                                ? 0.5
                                : 1,
                            width: 48,
                            height: 48,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onPress={() =>
                            confirm(
                              t("Usunąć komentarz?", "Delete Comment?"),
                              t(
                                "Treść komentarza zostanie ukryta.",
                                "The comment will be hidden.",
                              ),
                              async () => {
                                setDeletingId(comment.id);
                                try {
                                  await client.delete(
                                    `comments/${comment.id}/`,
                                  );
                                  await cache.cancelQueries({
                                    queryKey: commentsKey,
                                    exact: true,
                                  });
                                  if (session.aborted) return;
                                  cache.setQueryData<Comment[]>(
                                    commentsKey,
                                    (previous) =>
                                      previous?.filter(
                                        (item) => item.id !== comment.id,
                                      ),
                                  );
                                  void cache.invalidateQueries({
                                    queryKey: commentsKey,
                                    exact: true,
                                  });
                                } catch (error) {
                                  if (session.aborted) return;
                                  void cache.invalidateQueries({
                                    queryKey: commentsKey,
                                    exact: true,
                                  });
                                  throw error;
                                } finally {
                                  setDeletingId(null);
                                }
                              },
                              { action: t("Usuń", "Delete") },
                            )
                          }
                        >
                          {deletingId === comment.id ? (
                            <ActivityIndicator
                              accessibilityLabel={t(
                                "Usuwanie komentarza",
                                "Deleting comment",
                              )}
                              color={c.muted}
                            />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={17}
                              color={c.muted}
                            />
                          )}
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
