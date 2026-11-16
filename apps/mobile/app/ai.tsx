import {
  chatContext,
  questionInStudyOrder,
  type ChatMessage as Message,
} from "../src/lib/chat-context";
import MessageBubble from "../src/components/assistant/MessageBubble";
import { Collection, CollectionDivider } from "../src/components/Collection";
import CollectionRow from "../src/components/native/CollectionRow";
import { notify } from "../src/lib/alerts";
import { usageWindow, usageWindowLabels } from "../src/lib/ai-usage";
import { haptics } from "../src/lib/haptics";
import { userError } from "../src/lib/user-error";
import { DraftWriter, waitForDraftWrites } from "../src/lib/draft-writer";
import ChatAction from "../src/components/native/ChatAction";
import { assistantError } from "../src/lib/assistant-error";
import { createCompletionAnnouncement } from "../src/lib/accessibility-feedback";
import type { Quiz } from "@testownik/core/quiz/types";
import type { AIUsageSummary } from "@testownik/core/ai/usage";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HeaderHeightContext } from "expo-router/react-navigation";
import {
  Platform,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  AppState,
  BackHandler,
  Keyboard,
  Pressable,
} from "react-native";

import { useLocale } from "../src/lib/locale";
import { useTheme } from "../src/lib/theme";
import {
  Button,
  EmptyState,
  ErrorState,
  Label,
  Screen,
} from "../src/components/ui";
import { ai as sessionAi, api as sessionApi } from "../src/lib/api";
import { useQuizAiModel } from "../src/lib/quiz-ai-model";
import { useSession } from "../src/lib/session";
import { storage, tokenStore } from "../src/lib/storage";
import {
  consumeChat,
  hasChatContent,
  hasSuccessfulChatContent,
  type ChatPart,
} from "../src/lib/chat-stream";

export default function Assistant() {
  const { id, question } = useLocalSearchParams<{
    id: string;
    question: string;
  }>();
  const { user } = useSession();
  const { t, language } = useLocale();
  // Only reachable through a hand-made link; the app opens it from a question.
  if (!id || !question)
    return (
      <EmptyState
        symbol="bubble.left.and.text.bubble.right"
        ionicon="chatbubbles-outline"
        title={t("Wybierz pytanie", "Choose a Question")}
        description={t(
          "Asystent odpowiada na pytania o konkretne pytanie z quizu. Otwórz quiz i wybierz asystenta przy pytaniu.",
          "The assistant helps with a specific quiz question. Open a quiz and choose the assistant on a question.",
        )}
        actions={[
          {
            label: t("Zamknij", "Close"),
            onPress: () =>
              router.canGoBack() ? router.back() : router.replace("/"),
          },
        ]}
      />
    );
  return (
    <AssistantConversation key={`${user?.id}:${id}:${question}:${language}`} />
  );
}

interface ChatSummary {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

function AssistantConversation() {
  const navigation = useNavigation();
  const [api] = useState(() => sessionApi.forSession());
  const [ai] = useState(() => sessionAi.forSession());
  const [owner] = useState(() => tokenStore.session());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const modelPickerLock = useRef(false);
  const conversationLock = useRef(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [openingModel, setOpeningModel] = useState(false);
  const [modelSaveFailed, setModelSaveFailed] = useState(false);
  const { t, language } = useLocale();
  const c = useTheme();
  const [composerHeight, setComposerHeight] = useState(36);
  const [composerFocused, setComposerFocused] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const list = useRef<ScrollView>(null);
  const follow = useRef(true);
  const stopFollowing = useCallback(() => {
    follow.current = false;
  }, []);
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const [sending, setSending] = useState("");
  const {
      id,
      question: questionId,
      answerOrder,
    } = useLocalSearchParams<{
      id: string;
      question: string;
      answerOrder?: string;
    }>(),
    s = useSession();
  const selectedModel = useQuizAiModel(id);
  const models = useQuery({
    queryKey: ["ai-models", s.user?.id],
    enabled: !selectedModel.isPending,
    queryFn: () =>
      api.request<{
        models: { model: string; label: string }[];
        default_model: string | null;
      }>("ai/models/"),
  });
  const modelName = selectedModel.effectiveModel ?? models.data?.default_model;
  const quiz = useQuery({
      queryKey: ["ai-quiz", s.user?.id, id],
      queryFn: async () => {
        const cached = await s.library?.read();
        return cached?.quizzes[id] ?? api.request<Quiz>(`quizzes/${id}/`);
      },
    }),
    [prompt, setPrompt] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [output, setOutput] = useState<ChatPart[]>([]),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [historyReady, setHistoryReady] = useState(false),
    [historyFailure, setHistoryFailure] = useState(false),
    [historyAttempt, setHistoryAttempt] = useState(0),
    [historyOpen, setHistoryOpen] = useState(false),
    [opening, setOpening] = useState<string | null>(null);
  // Conversations are stored on the server (the web saves them too), so earlier
  // ones about this quiz can be reopened and continued.
  const usage = useQuery({
    queryKey: ["ai-usage", s.user?.id],
    queryFn: () => api.request<AIUsageSummary>("ai/usage/me/?days=7"),
    enabled: Platform.OS === "ios",
  });
  const chats = useQuery({
    queryKey: ["ai-chats", s.user?.id, id],
    enabled: historyOpen,
    queryFn: async () =>
      (
        await api.request<{ results: ChatSummary[] }>(
          `ai/chats/?quiz=${encodeURIComponent(id)}&limit=50`,
        )
      ).results,
  });
  useEffect(() => {
    if (busy || messages.length > 0) return;
    // flexGrow can keep the content size unchanged when the pending message
    // disappears, so onContentSizeChange alone cannot restore this position.
    const frame = requestAnimationFrame(() => {
      list.current?.scrollTo({
        y: 0,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, messages.length, headerHeight]);
  const draftKey = `chat-draft.${s.user?.id}.${id}.${questionId}`;
  const draftError = useCallback(() => {
    if (owner.aborted) return;
    setFailure(
      t(
        "Nie udało się zapisać szkicu na urządzeniu.",
        "Could not save your draft on this device.",
      ),
    );
  }, [owner, t]);
  const draftWriter = useMemo(
    () => new DraftWriter<string>(draftKey, storage, draftError),
    [draftKey, draftError],
  );
  const abort = useRef<AbortController | null>(null),
    openingRequest = useRef<AbortController | null>(null),
    conversation = useRef<string | null>(null);
  if (conversation.current === null) conversation.current = Crypto.randomUUID();
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || !historyOpen) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (opening) return true;
          setHistoryOpen(false);
          return true;
        },
      );
      return () => subscription.remove();
    }, [historyOpen, opening]),
  );
  const question = questionInStudyOrder(
    quiz.data?.questions.find((q) => q.id === questionId),
    answerOrder,
  );
  useEffect(() => {
    let current = true;
    const background = AppState.addEventListener("change", (state) => {
      if (state !== "active") void draftWriter.flush();
    });
    void waitForDraftWrites(storage, draftKey)
      .then(() =>
        Promise.all([
          storage.read<Message[]>(`chat.${s.user?.id}.${id}`, []),
          storage.read<string>(draftKey, ""),
        ]),
      )
      .then(([history, draft]) => {
        if (current) {
          setMessages(history);
          setPrompt(typeof draft === "string" ? draft : "");
          setHistoryReady(true);
        }
      })
      .catch(() => {
        if (current) setHistoryFailure(true);
      });
    return () => {
      current = false;
      background.remove();
      void draftWriter.flush();
      abort.current?.abort();
      abort.current = null;
      openingRequest.current?.abort();
      openingRequest.current = null;
    };
  }, [draftKey, draftWriter, id, s.user?.id, t, historyAttempt]);
  async function openModelPicker() {
    if (
      modelPickerLock.current ||
      conversationLock.current ||
      busy ||
      opening ||
      !historyReady ||
      owner.aborted
    )
      return;
    modelPickerLock.current = true;
    setOpeningModel(true);
    setModelSaveFailed(false);
    setFailure("");
    Keyboard.dismiss();
    try {
      draftWriter.schedule(prompt);
      await draftWriter.flushOrThrow();
      if (!mounted.current || owner.aborted || !navigation.isFocused()) return;
      router.push({ pathname: "/settings-model", params: { quiz: id } });
    } catch {
      if (!mounted.current || owner.aborted) return;
      // Retry the local save beside the model row, without sending a message.
      setFailure("");
      setModelSaveFailed(true);
    } finally {
      modelPickerLock.current = false;
      if (mounted.current && !owner.aborted) setOpeningModel(false);
    }
  }
  async function run(text = prompt) {
    const submitted = text.trim();
    if (
      !question ||
      !historyReady ||
      modelPickerLock.current ||
      conversationLock.current ||
      selectedModel.isPending ||
      selectedModel.error ||
      openingRequest.current ||
      abort.current ||
      !submitted
    )
      return;
    setBusy(true);
    setFailure("");
    setOutput([]);
    const controller = new AbortController();
    abort.current = controller;
    const announce = createCompletionAnnouncement(controller.signal);
    let final: ChatPart[] = [];
    let committed = false;
    let presentedExercise = false;
    const next: Message[] = [
      ...messages,
      {
        id: Crypto.randomUUID(),
        role: "user",
        questionId: question.id,
        parts: [{ type: "text", text: submitted }],
      },
    ];
    draftWriter.schedule(submitted);
    void draftWriter.flush();
    setSending(submitted);
    setPrompt("");
    setComposerHeight(44);
    follow.current = true;
    try {
      const response = await ai.response("ai/chat", {
        method: "POST",
        body: JSON.stringify({
          ...chatContext(next, quiz.data!, question.id),
          quizId: id,
          quiz: {
            title: quiz.data?.title,
            description: quiz.data?.description,
          },
          question,
          userName: s.user?.full_name,
          conversationId: conversation.current,
          config: { modelName: selectedModel.effectiveModel },
        }),
        signal: controller.signal,
        timeoutMs: 120000,
      });
      final = await consumeChat(
        response,
        (parts) => {
          if (abort.current === controller && !controller.signal.aborted) {
            if (
              !presentedExercise &&
              parts.some(
                (part) =>
                  part.type === "dynamic-tool" &&
                  part.state === "output-available" &&
                  ["generate_practice_questions", "get_question"].includes(
                    part.toolName,
                  ),
              )
            ) {
              presentedExercise = true;
              follow.current = false;
              Keyboard.dismiss();
            }
            setOutput(parts);
          }
        },
        controller.signal,
      );
      if (abort.current !== controller || controller.signal.aborted) return;
      if (!hasChatContent(final))
        throw new Error(
          t(
            "Asystent nie zwrócił odpowiedzi. Spróbuj wysłać pytanie ponownie.",
            "No response received. Try sending your message again.",
          ),
        );
      {
        const history: Message[] = [
          ...next,
          {
            id: Crypto.randomUUID(),
            role: "assistant",
            parts: final,
          },
        ];
        committed = true;
        draftWriter.schedule("");
        void draftWriter.flush();
        setMessages(history);
        setOutput([]);
        setPrompt("");
        if (navigation.isFocused() && hasSuccessfulChatContent(final))
          announce(t("Odpowiedź gotowa", "Reply ready"));
        try {
          await storage.write(`chat.${s.user?.id}.${id}`, history);
        } catch {
          if (abort.current === controller)
            setFailure(
              t(
                "Odpowiedź jest widoczna, ale nie udało się zapisać rozmowy na urządzeniu.",
                "The response is available, but this conversation could not be saved on your device.",
              ),
            );
        }
      }
    } catch (e) {
      if (abort.current !== controller) return;
      setOutput([]);
      if (!committed) setPrompt(submitted);
      if (!controller.signal.aborted) setFailure(assistantError(e, t));
    } finally {
      if (abort.current === controller) {
        if (controller.signal.aborted) {
          if (!committed) setPrompt(submitted);
          setOutput([]);
        }
        abort.current = null;
        setSending("");
        setBusy(false);
        // Each reply spends allowance; keep the usage menu current.
        void usage.refetch();
      }
    }
  }
  async function openChat(chatId: string) {
    if (modelPickerLock.current || conversationLock.current) return;
    if (
      !historyReady ||
      modelPickerLock.current ||
      conversationLock.current ||
      abort.current ||
      openingRequest.current
    )
      return;
    const controller = new AbortController();
    openingRequest.current = controller;
    setOpening(chatId);
    try {
      const chat = await api.request<{
        id: string;
        messages: {
          message_id: string;
          role: string;
          content: ChatPart[];
          order: number;
        }[];
      }>(`ai/chats/${chatId}/`, { signal: controller.signal });
      if (openingRequest.current !== controller || controller.signal.aborted)
        return;
      const history: Message[] = [...chat.messages]
        .sort((a, b) => a.order - b.order)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m, index) => ({
          id: m.message_id || `${chat.id}-${index}`,
          role: m.role as Message["role"],
          parts: Array.isArray(m.content) ? m.content : [],
        }));
      setMessages(history);
      setOutput([]);
      setFailure("");
      conversation.current = chat.id;
      setHistoryOpen(false);
      // Only the local cache for reopening later; the chat itself is open.
      await storage
        .write(`chat.${s.user?.id}.${id}`, history)
        .catch(() => undefined);
    } catch (error) {
      if (controller.signal.aborted) return;
      notify(
        t("Nie udało się otworzyć rozmowy", "Couldn’t Open Conversation"),
        userError(error, t),
      );
    } finally {
      if (openingRequest.current === controller) {
        openingRequest.current = null;
        setOpening(null);
      }
    }
  }
  // Earlier conversations stay in history, so starting over needs no warning.
  async function newConversation() {
    if (
      !historyReady ||
      abort.current ||
      openingRequest.current ||
      modelPickerLock.current ||
      conversationLock.current ||
      owner.aborted
    )
      return;
    conversationLock.current = true;
    setStartingConversation(true);
    setFailure("");
    const current = () =>
      mounted.current && !owner.aborted && navigation.isFocused();
    try {
      // Starting a new thread retains its unsent composer. Complete its save
      // before acknowledging the new conversation or clearing the old cache.
      draftWriter.schedule(prompt);
      await draftWriter.flushOrThrow();
      if (!current()) return;
      await storage.remove(`chat.${s.user?.id}.${id}`);
      // A completed removal also clears a temporarily covered conversation.
      if (!mounted.current || owner.aborted) return;
      setMessages([]);
      setOutput([]);
      setFailure("");
      conversation.current = Crypto.randomUUID();
      haptics.selection();
    } catch (error) {
      if (!current()) return;
      // A local save retry must never become the generic Send-message retry.
      setFailure("");
      notify(
        t("Nie rozpoczęto nowej rozmowy", "Couldn’t Start New Conversation"),
        userError(error, t),
      );
    } finally {
      conversationLock.current = false;
      if (mounted.current && !owner.aborted) setStartingConversation(false);
    }
  }

  return (
    <Screen
      backgroundColor={Platform.OS === "ios" ? c.surface : undefined}
      scroll={false}
      footerInset={!composerFocused}
      onFooterHeight={setFooterHeight}
      footer={
        <View style={{ gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 10,
              paddingBottom: 0,
            }}
          >
            <TextInput
              testID="assistant-composer"
              accessibilityLabel={t(
                "Wiadomość do asystenta",
                "Message the assistant",
              )}
              placeholder={t(
                "Zapytaj o to pytanie…",
                "Ask about this question…",
              )}
              placeholderTextColor={c.muted}
              multiline
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              onContentSizeChange={(event) =>
                // Grows with the message like Messages, up to about six lines.
                setComposerHeight(
                  Math.max(
                    36,
                    Math.min(
                      150,
                      Math.ceil(event.nativeEvent.contentSize.height),
                    ),
                  ),
                )
              }
              editable={
                !busy &&
                !opening &&
                !openingModel &&
                !startingConversation &&
                historyReady
              }
              value={prompt}
              onChangeText={(text) => {
                if (modelPickerLock.current || conversationLock.current) return;
                setPrompt(text);
                draftWriter.schedule(text);
              }}
              style={{
                flex: 1,
                height: composerHeight,
                minHeight: 36,
                maxHeight: 150,
                paddingHorizontal: 14,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 18,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.border,
                backgroundColor: c.bg,
                color: c.text,
                fontSize: 17,
                lineHeight: 21,
              }}
            />
            <ChatAction
              label={
                busy
                  ? t("Zatrzymaj odpowiedź", "Stop response")
                  : t("Wyślij wiadomość", "Send message")
              }
              stopping={busy}
              disabled={
                !busy &&
                (!historyReady ||
                  !!opening ||
                  openingModel ||
                  startingConversation ||
                  selectedModel.isPending ||
                  !!selectedModel.error ||
                  !prompt.trim() ||
                  !question)
              }
              onPress={() => (busy ? abort.current?.abort() : void run())}
            />
          </View>
          <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>
            {t(
              "AI może się mylić. Sprawdzaj odpowiedzi.",
              "AI can make mistakes. Check its answers.",
            )}
          </Text>
        </View>
      }
    >
      {Platform.OS !== "ios" ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  "Poprzednie rozmowy",
                  "Previous Conversations",
                )}
                accessibilityState={{
                  expanded: historyOpen,
                  disabled:
                    busy ||
                    !!opening ||
                    openingModel ||
                    startingConversation ||
                    !historyReady,
                }}
                disabled={
                  busy ||
                  !!opening ||
                  openingModel ||
                  startingConversation ||
                  !historyReady
                }
                onPress={() => {
                  Keyboard.dismiss();
                  setHistoryOpen((open) => !open);
                }}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity:
                    busy || opening || !historyReady ? 0.45 : pressed ? 0.6 : 1,
                })}
              >
                <Ionicons
                  name="time-outline"
                  size={24}
                  color={historyOpen ? c.primary : c.text}
                />
              </Pressable>
            ),
          }}
        />
      ) : null}
      <ScrollView
        testID="assistant-conversation"
        style={{ flex: 1 }}
        ref={list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentInsetAdjustmentBehavior="never"
        scrollIndicatorInsets={
          Platform.OS === "ios" ? { bottom: footerHeight } : undefined
        }
        contentContainerStyle={{
          padding: 20,
          paddingTop: 20 + (Platform.OS === "ios" ? headerHeight : 0),
          // iOS formSheet expands its first UIScrollView over sibling footers.
          // Keep the final reply and its actions scrollable above the measured composer.
          paddingBottom: 20 + (Platform.OS === "ios" ? footerHeight : 0),
          gap: 16,
          flexGrow: 1,
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
        }}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
          follow.current =
            contentOffset.y + layoutMeasurement.height >=
            contentSize.height - 80;
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (!follow.current) return;
          if (messages.length > 0 || busy)
            list.current?.scrollToEnd({ animated: false });
          else
            // A failed first reply removes the pending bubble. Restore the
            // question below the native header, rather than leaving a stale offset.
            list.current?.scrollTo({
              y: 0,
              animated: false,
            });
        }}
      >
        <Collection>
          <CollectionRow
            title={t("Model AI", "AI Model")}
            detail={
              openingModel
                ? t("Zapisuję szkic…", "Saving draft…")
                : selectedModel.isPending
                  ? t("Wczytuję…", "Loading…")
                  : selectedModel.error
                    ? t("Wybierz model", "Choose a Model")
                    : models.isLoading
                      ? t("Wczytuję…", "Loading…")
                      : models.data?.models?.find(
                          (model) => model.model === modelName,
                        )?.label ||
                        modelName ||
                        t("Domyślny", "Default")
            }
            symbol="sparkles"
            ionicon="sparkles-outline"
            disabled={
              busy ||
              !!opening ||
              openingModel ||
              startingConversation ||
              !historyReady
            }
            onPress={() => void openModelPicker()}
          />
        </Collection>
        {modelSaveFailed ? (
          <View accessibilityRole="alert" style={{ gap: 8 }}>
            <Label>
              {t(
                "Nie udało się zapisać szkicu na urządzeniu.",
                "Could not save your draft on this device.",
              )}
            </Label>
            <Button
              kind="secondary"
              disabled={openingModel}
              onPress={() => void openModelPicker()}
            >
              {t(
                "Spróbuj otworzyć wybór modelu ponownie",
                "Retry Opening Model Picker",
              )}
            </Button>
          </View>
        ) : null}
        {selectedModel.error ? (
          <ErrorState
            error={selectedModel.error}
            retry={() => void selectedModel.refetch()}
          />
        ) : null}
        {historyFailure ? (
          <View accessibilityRole="alert" style={{ gap: 8 }}>
            <Label>
              {t(
                "Nie udało się otworzyć zapisanej rozmowy na urządzeniu.",
                "Could not open the saved conversation on this device.",
              )}
            </Label>
            <Button
              kind="secondary"
              onPress={() => {
                setHistoryFailure(false);
                setHistoryAttempt((attempt) => attempt + 1);
              }}
            >
              {t("Spróbuj ponownie", "Try Again")}
            </Button>
          </View>
        ) : !historyReady ? (
          <Label>{t("Otwieram rozmowę…", "Opening conversation…")}</Label>
        ) : null}
        {Platform.OS === "ios" ? (
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="clock.arrow.circlepath"
              selected={historyOpen}
              disabled={
                busy ||
                !!opening ||
                openingModel ||
                startingConversation ||
                !historyReady
              }
              onPress={() => setHistoryOpen((open) => !open)}
            >
              {t("Poprzednie rozmowy", "Previous Conversations")}
            </Stack.Toolbar.Button>
            <Stack.Toolbar.Button
              icon="square.and.pencil"
              hidden={messages.length === 0}
              disabled={
                busy ||
                !!opening ||
                openingModel ||
                startingConversation ||
                !historyReady
              }
              onPress={newConversation}
            >
              {t("Nowa rozmowa", "New Conversation")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        ) : null}
        {/* Android's app bar already has the up arrow; a Close button duplicated it. */}
        {Platform.OS === "android" ? null : (
          <Stack.Toolbar placement="right">
            {usage.data?.session ? (
              <Stack.Toolbar.Menu
                icon="gauge.with.dots.needle.33percent"
                accessibilityLabel={t("Wykorzystanie AI", "AI Usage")}
              >
                {(
                  [
                    [usageWindowLabels(t).session, usage.data.session],
                    [usageWindowLabels(t).weekly, usage.data.weekly],
                  ] as const
                ).map(([label, raw]) => {
                  const window = usageWindow(raw, t);
                  return (
                    <Stack.Toolbar.MenuAction
                      key={label}
                      disabled
                      subtitle={
                        window.unlimited
                          ? undefined
                          : (window.resets ?? undefined)
                      }
                      onPress={() => {}}
                    >
                      {window.unlimited
                        ? `${label}: ${t("bez limitu", "Unlimited")}`
                        : t(
                            `${label}: pozostało ${100 - Math.round(window.fraction * 100)}%`,
                            `${label}: ${100 - Math.round(window.fraction * 100)}% left`,
                          )}
                    </Stack.Toolbar.MenuAction>
                  );
                })}
                <Stack.Toolbar.MenuAction
                  icon="chart.bar"
                  onPress={() => router.push("/usage")}
                >
                  {t("Szczegóły wykorzystania", "Usage Details")}
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
            ) : null}
            <Stack.Toolbar.Button
              icon={Platform.OS === "ios" ? "xmark" : undefined}
              accessibilityLabel={t("Zamknij asystenta", "Close assistant")}
              onPress={() => router.back()}
            >
              {t("Zamknij", "Close")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        )}
        {historyOpen ? (
          <View style={{ gap: 12 }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, fontWeight: "700", color: c.text }}
            >
              {t("Poprzednie rozmowy", "Previous Conversations")}
            </Text>
            {chats.isPending ? <ActivityIndicator /> : null}
            {opening ? (
              <Label muted>
                {t("Otwieram rozmowę…", "Opening conversation…")}
              </Label>
            ) : null}
            {chats.error ? (
              <ErrorState
                error={chats.error}
                retry={() => void chats.refetch()}
              />
            ) : null}
            {chats.data?.length === 0 ? (
              <Label muted>
                {t(
                  "Nie masz jeszcze zapisanych rozmów o tym quizie.",
                  "You have no saved conversations about this quiz yet.",
                )}
              </Label>
            ) : null}
            {chats.data?.length ? (
              <Collection>
                {chats.data.map((chat, index) => (
                  <Fragment key={chat.id}>
                    {index ? <CollectionDivider /> : null}
                    <CollectionRow
                      title={chat.title || t("Rozmowa", "Conversation")}
                      detail={[
                        new Date(chat.updated_at).toLocaleDateString(
                          language === "pl" ? "pl-PL" : "en-GB",
                          { day: "numeric", month: "short" },
                        ),
                        t(
                          `Wiadomości: ${chat.message_count}`,
                          `${chat.message_count} messages`,
                        ),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      symbol="bubble.left.and.bubble.right"
                      ionicon="chatbubbles-outline"
                      disabled={opening !== null}
                      onPress={() => void openChat(chat.id)}
                    />
                  </Fragment>
                ))}
              </Collection>
            ) : null}
            <Button kind="secondary" onPress={() => setHistoryOpen(false)}>
              {t("Wróć do rozmowy", "Back to Conversation")}
            </Button>
          </View>
        ) : null}
        {historyOpen ? null : (
          <>
            {quiz.isPending ? (
              <Label>{t("Otwieram pytanie…", "Opening question…")}</Label>
            ) : null}
            {quiz.error ? (
              <ErrorState
                title={t(
                  "Nie udało się otworzyć pytania",
                  "Couldn’t Open Question",
                )}
                error={quiz.error}
                retry={() => void quiz.refetch()}
              />
            ) : null}
            {quiz.data && !question ? (
              <Label>
                {t(
                  "To pytanie nie jest już dostępne. Wróć do quizu i wybierz inne.",
                  "This question is no longer available. Return to the quiz and choose another.",
                )}
              </Label>
            ) : null}
            {question && messages.length === 0 && !busy ? (
              <View style={{ gap: 16, paddingTop: 12 }}>
                {!composerFocused ? (
                  <>
                    <Text
                      accessibilityRole="header"
                      style={{ fontSize: 24, fontWeight: "700", color: c.text }}
                    >
                      {t("Jak mogę Ci pomóc?", "How Can I Help?")}
                    </Text>
                    <Label muted>
                      {t(
                        "Rozpracuj to pytanie krok po kroku. Asystent zna jego treść i odpowiedzi.",
                        "Work through this question step by step. The assistant has its text and answers.",
                      )}
                    </Label>
                  </>
                ) : null}
                <Collection>
                  {[
                    {
                      label: t("Wyjaśnij pojęcie", "Explain the Concept"),
                      symbol: "lightbulb" as const,
                      ionicon: "bulb-outline" as const,
                      prompt: t(
                        "Wyjaśnij pojęcia potrzebne do rozwiązania tego pytania. Nie zdradzaj jeszcze poprawnej odpowiedzi.",
                        "Explain the concepts needed to solve this question. Don't reveal the correct answer yet.",
                      ),
                    },
                    {
                      label: t(
                        "Naprowadź mnie na rozwiązanie",
                        "Guide Me Through It",
                      ),
                      symbol: "list.number" as const,
                      ionicon: "list-outline" as const,
                      prompt: t(
                        "Naprowadź mnie krok po kroku na rozwiązanie tego pytania, nie zdradzając od razu poprawnej odpowiedzi.",
                        "Guide me through solving this question step by step, without revealing the correct answer right away.",
                      ),
                    },
                    ...(composerFocused
                      ? []
                      : [
                          {
                            label: t(
                              "Przećwicz podobne pytanie",
                              "Practice a Similar Question",
                            ),
                            symbol: "arrow.trianglehead.2.clockwise" as const,
                            ionicon: "repeat-outline" as const,
                            prompt: t(
                              "Ułóż jedno krótkie pytanie ćwiczeniowe podobne do tego, korzystając z interaktywnego ćwiczenia. Nie zdradzaj odpowiedzi przed sprawdzeniem.",
                              "Create one short, similar practice question using an interactive exercise. Don't reveal its answer before I check it.",
                            ),
                          },
                        ]),
                  ].map((action, index) => (
                    <Fragment key={action.label}>
                      {index ? <CollectionDivider /> : null}
                      <CollectionRow
                        title={action.label}
                        symbol={action.symbol}
                        ionicon={action.ionicon}
                        disclosure={false}
                        disabled={
                          !historyReady ||
                          selectedModel.isPending ||
                          !!selectedModel.error ||
                          !!prompt.trim()
                        }
                        onPress={() => void run(action.prompt)}
                      />
                    </Fragment>
                  ))}
                </Collection>
                {Platform.OS === "ios" ? (
                  <Collection>
                    <CollectionRow
                      title={t("Poprzednie rozmowy", "Previous Conversations")}
                      symbol="clock.arrow.circlepath"
                      ionicon="time-outline"
                      disabled={!historyReady}
                      onPress={() => setHistoryOpen(true)}
                    />
                  </Collection>
                ) : null}
              </View>
            ) : null}
            {messages.map((message) => {
              const index =
                quiz.data?.questions.findIndex(
                  (q) => q.id === message.questionId,
                ) ?? -1;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onInteraction={stopFollowing}
                  questionLabel={
                    message.questionId
                      ? index < 0
                        ? t("Wcześniejsze pytanie", "Earlier question")
                        : t(
                            `Pytanie ${index + 1} w quizie`,
                            `Quiz question ${index + 1}`,
                          )
                      : undefined
                  }
                />
              );
            })}
            {sending ? (
              <View
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "88%",
                  borderRadius: 20,
                  backgroundColor: c.tint,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ fontSize: 16, lineHeight: 24, color: c.text }}>
                  {sending}
                </Text>
              </View>
            ) : null}
            {output.length ? (
              <MessageBubble
                streaming
                onInteraction={stopFollowing}
                message={{ id: "streaming", role: "assistant", parts: output }}
              />
            ) : busy ? (
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <ActivityIndicator color={c.primary} />
                <Label muted>
                  {t("Asystent pisze…", "Assistant is typing…")}
                </Label>
              </View>
            ) : null}
            {failure ? (
              <View
                accessibilityRole="alert"
                style={{ paddingVertical: 8, gap: 6, alignItems: "flex-start" }}
              >
                <Text style={{ fontSize: 15, lineHeight: 22, color: c.danger }}>
                  {failure}
                </Text>
                {/* The unsent message is back in the composer; resend it as is. */}
                {prompt.trim() && !busy ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => void run(prompt)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <Text
                      style={{
                        color: c.primary,
                        fontSize: 15,
                        fontWeight: "600",
                      }}
                    >
                      {t("Spróbuj ponownie", "Try Again")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {messages.length > 0 && Platform.OS !== "ios" ? (
              <Button
                kind="secondary"
                disabled={
                  busy || !!opening || openingModel || startingConversation
                }
                onPress={newConversation}
              >
                {t("Nowa rozmowa", "New Conversation")}
              </Button>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
