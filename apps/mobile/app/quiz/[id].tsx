import type {
  AnswerRecord,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import {
  checkAnswerCorrectness,
  deriveSettings,
  getMasteredCount,
  isQuizComplete,
  pickNextQuestion,
  resolveCurrentQuestion,
} from "@testownik/core/quiz/session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import EditorAction from "../../src/components/native/EditorAction";
import StudyImage from "../../src/components/StudyImage";
import ExternalImageNotice from "../../src/components/ExternalImageNotice";
import {
  imageAllowed,
  imageHost,
  isTrustedImage,
} from "../../src/lib/image-policy";
import InlineHint, { AnswerHint } from "../../src/components/InlineHint";
import { useAiResponse } from "../../src/lib/use-ai-response";
import type { ReactNode } from "react";
import { useLocale } from "../../src/lib/locale";
import PressableScale from "../../src/components/PressableScale";
import {
  headerMenus,
  type MenuAction,
} from "../../src/components/header-action";
import RichText from "../../src/components/RichText";
import SyncStatus from "../../src/components/SyncStatus";
import OptionIndicator from "../../src/components/native/OptionIndicator";
import ResultIcon from "../../src/components/native/ResultIcon";
import {
  Button,
  ErrorScreen,
  Label,
  Loading,
  Screen,
  notify,
  useConfirm,
} from "../../src/components/ui";
import { api, API_URL } from "../../src/lib/api";
import { haptics } from "../../src/lib/haptics";
import { removeQuizImages, saveQuizImages } from "../../src/lib/offline-images";
import { failureTitle, userError } from "../../src/lib/user-error";
import { ApiError } from "../../src/lib/client";
import QuizCompleteCard from "../../src/components/QuizCompleteCard";
import { useSession } from "../../src/lib/session";
import { useTheme } from "../../src/lib/theme";

// Event handlers and effects only; reading the clock during render is impure.
const clock = () => Date.now();

export default function Study() {
  const { t } = useLocale();
  const confirm = useConfirm();
  const [hint, setHint] = useState<{
    question: string;
    mode: "hint" | "explain";
    /** Asking again while a hint is open generates a fresh one. */
    attempt: number;
  } | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useSession(),
    c = useTheme(),
    qc = useQueryClient(),
    insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]),
    // The checked question is kept as shown: the saved session already points
    // at the next one, so a refetch must not swap it out before "Next".
    [result, setResult] = useState<{
      question: NonNullable<ReturnType<typeof resolveCurrentQuestion>>;
      correct: boolean;
    } | null>(null),
    [imageApproval, setImageApproval] = useState<{
      scope: string;
      hosts: string[];
    } | null>(null),
    [saving, setSaving] = useState(false);
  const mediaScope = `${s.user?.id}:${id}`;
  const images = useCallback(
    (url: string) =>
      imageAllowed(
        url,
        (value) =>
          isTrustedImage(value, API_URL) ||
          (imageApproval?.scope === mediaScope &&
            imageApproval.hosts.includes(imageHost(value) ?? "")),
      ),
    [imageApproval, mediaScope],
  );
  const scroll = useRef<ScrollView>(null);
  const started = useRef(0),
    activeSeconds = useRef(0),
    active = useRef(true),
    // State updates land a render late; a second tap in between must not
    // record the answer twice or restart twice.
    working = useRef(false);
  const query = useQuery({
    queryKey: ["quiz", id, s.user?.id],
    enabled: !!s.library,
    networkMode: "always",
    queryFn: async () => {
      const cached = await s.library!.read();
      if (s.offline && cached.quizzes[id]) return cached.quizzes[id];
      if (cached.queue.some((x) => x.quiz_id === id)) return cached.quizzes[id];
      try {
        const q = await api.request<QuizWithUserProgress>(
          `quizzes/${id}/?include=user_settings,current_session`,
        );
        await s.library!.cache(q);
        void saveQuizImages(q);
        return q;
      } catch (e) {
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
          // Deleted, trashed or unshared: stop offering it on this device.
          if (e.status !== 401 && cached.quizzes[id]) {
            await s.library!.discard(id).catch(() => undefined);
            void qc.invalidateQueries({ queryKey: ["offline"] });
            void qc.invalidateQueries({ queryKey: ["recent"] });
          }
          throw e;
        }
        if (cached.quizzes[id]) return cached.quizzes[id];
        throw e;
      }
    },
  });
  useEffect(() => {
    started.current = clock();
    const listener = AppState.addEventListener("change", (state) => {
      if (active.current)
        activeSeconds.current += (clock() - started.current) / 1000;
      active.current = state === "active";
      started.current = clock();
    });
    return () => listener.remove();
  }, []);
  const restoreQuiz = async () => {
    try {
      await api.post(`quizzes/${id}/restore/`);
      haptics.success();
      void qc.invalidateQueries({ queryKey: ["library"] });
      await query.refetch();
    } catch (error) {
      notify(
        t("Nie udało się przywrócić", "Couldn’t Restore Quiz"),
        userError(error, t),
      );
    }
  };
  if (!s.ready || query.isLoading) return <Loading />;
  if (!s.user)
    return (
      <Screen>
        <Button onPress={() => router.replace("/login")}>
          {t("Zaloguj się, aby rozpocząć", "Sign In to Start")}
        </Button>
      </Screen>
    );
  if (query.error || !query.data)
    return (
      <ErrorScreen
        error={query.error}
        retry={() => void query.refetch()}
        actions={
          // Your own quiz in the trash can come straight back.
          query.error instanceof ApiError &&
          query.error.status === 403 &&
          /restore/i.test(query.error.message)
            ? [
                {
                  label: t("Przywróć quiz", "Restore Quiz"),
                  primary: true,
                  onPress: () => void restoreQuiz(),
                },
              ]
            : []
        }
      />
    );
  const quiz = query.data,
    session = quiz.current_session,
    settings = deriveSettings(quiz.user_settings),
    answers = session?.answers ?? [],
    done = isQuizComplete(quiz.questions, answers, settings),
    checked = result ? result.correct : null,
    question = result?.question ?? resolveCurrentQuestion(quiz, settings),
    mastered = getMasteredCount(quiz.questions, answers, settings);
  async function submit() {
    if (!question || !session || working.current) return;
    working.current = true;
    setSaving(true);
    try {
      const correct = checkAnswerCorrectness(question, selected);
      const record: AnswerRecord = {
        id: Crypto.randomUUID(),
        question: question.id,
        selected_answers: selected,
        was_correct: correct,
        answered_at: new Date().toISOString(),
      };
      const history = [...answers, record];
      const next = pickNextQuestion({
        questions: quiz.questions,
        answers: history,
        settings,
        currentQuestionId: question.id,
        seed: session.id,
      });
      const elapsed = Math.min(
        3600,
        Math.max(
          0,
          Math.round(
            activeSeconds.current +
              (active.current ? (clock() - started.current) / 1000 : 0),
          ),
        ),
      );
      const updated = {
        ...quiz,
        current_session: {
          ...session,
          answers: history,
          current_question: next?.id ?? null,
          study_time: session.study_time + elapsed,
        },
      };
      await s.library!.enqueue(
        {
          request_id: record.id,
          quiz_id: id,
          session_id: session.id,
          version: quiz.version,
          question_id: question.id,
          selected_answers: selected,
          elapsed_seconds: elapsed,
          next_question: next?.id ?? null,
          local: record,
        },
        updated,
      );
      if (correct) haptics.success();
      else haptics.error();
      setResult({ question, correct });
      void s.sync();
    } catch (error) {
      // The selection stays, so checking again retries.
      haptics.error();
      notify(
        t("Nie zapisano odpowiedzi", "Couldn’t Save Answer"),
        userError(error, t),
      );
    } finally {
      working.current = false;
      setSaving(false);
    }
  }
  async function next() {
    const state = await s.library!.read();
    qc.setQueryData(["quiz", id, s.user?.id], state.quizzes[id]);
    setResult(null);
    setHint(null);
    setSelected([]);
    scroll.current?.scrollTo({ y: 0, animated: false });
    started.current = clock();
    activeSeconds.current = 0;
  }
  const go = (
    pathname:
      | "/stats"
      | "/share"
      | "/community"
      | "/editor"
      | "/search-quiz"
      | "/history",
  ) => router.push({ pathname, params: { id } });
  // The finished session stays in history, so starting over needs no confirmation.
  const restart = async () => {
    if (working.current) return;
    working.current = true;
    setSaving(true);
    try {
      await s.sync();
      if ((await s.library!.read()).queue.some((x) => x.quiz_id === id))
        throw new Error(
          t("Najpierw zsynchronizuj odpowiedzi.", "Sync your answers first."),
        );
      await api.delete(`quizzes/${id}/progress/`);
      await s.library!.discard(id);
      setResult(null);
      setHint(null);
      setSelected([]);
      haptics.selection();
      await query.refetch();
    } catch (error) {
      notify(
        t("Nie udało się zacząć od nowa", "Couldn’t Start Over"),
        userError(error, t),
      );
    } finally {
      working.current = false;
      setSaving(false);
    }
  };
  const askAssistant = (target: NonNullable<typeof question>) =>
    router.push({
      pathname: "/ai",
      params: {
        id,
        question: target.id,
        answerOrder: JSON.stringify(target.answers.map((a) => a.id)),
      },
    });
  const makeCopy = async () => {
    const copy = await api.post<{ id: string }>(`quizzes/${id}/copy/`);
    router.push({ pathname: "/editor", params: { id: copy.id } });
  };
  const removeLocalCopy = () =>
    confirm(
      t("Usunąć lokalną kopię?", "Remove Local Copy?"),
      t(
        "Niezsynchronizowane odpowiedzi zostaną utracone.",
        "Unsynced answers will be lost.",
      ),
      async () => {
        await s.library!.discard(id);
        removeQuizImages(quiz);
        setResult(null);
        setHint(null);
        setSelected([]);
        await query.refetch();
        await s.sync();
      },
      { action: t("Usuń", "Remove") },
    );
  const complete = done && checked === null;
  const total = quiz.questions.length;
  const minutes = Math.round((session?.study_time ?? 0) / 60);
  const studyTime =
    minutes >= 60
      ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
      : `${minutes} min`;
  const primary = complete
    ? "restart"
    : question
      ? checked === null
        ? "check"
        : "next"
      : quiz.can_edit
        ? "add"
        : null;
  const primaryLabel = {
    restart: t("Zacznij od nowa", "Start Again"),
    check: t("Sprawdź", "Check"),
    next: t("Dalej", "Next"),
    add: t("Dodaj pytanie", "Add Question"),
  };
  // Checking with nothing selected is valid: some questions have no correct answer.
  const primaryDisabled =
    (primary === "check" || primary === "restart") && saving;
  const runPrimary = () =>
    primary === "restart"
      ? void restart()
      : primary === "check"
        ? submit()
        : primary === "next"
          ? next()
          : primary === "add"
            ? go("/editor")
            : undefined;
  const hintLabel =
    checked === null
      ? t("Podpowiedź AI", "AI Hint")
      : t("Wyjaśnienie AI", "AI Explanation");
  const showHint = (target: NonNullable<typeof question>) => {
    const mode = checked === null ? "hint" : "explain";
    setHint((open) => ({
      question: target.id,
      mode,
      attempt:
        open?.question === target.id && open.mode === mode
          ? open.attempt + 1
          : 0,
    }));
    // The hint opens below the answers; bring it into view.
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250);
  };
  // Stack.Toolbar drops SF-symbol and text-only items on Android; use the JS bars.
  const native = Platform.OS === "ios";
  const menu: (MenuAction & { icon: NonNullable<MenuAction["icon"]> })[][] = [
    [
      {
        title: t("Historia odpowiedzi", "Answer History"),
        icon: "clock.arrow.circlepath",
        onPress: () => go("/history"),
      },
      {
        title: t("Statystyki", "Statistics"),
        icon: "chart.bar",
        onPress: () => go("/stats"),
      },
      {
        title: t("Szukaj w pytaniach", "Search Questions"),
        icon: "magnifyingglass",
        onPress: () => go("/search-quiz"),
      },
    ],
    [
      ...(quiz.can_edit
        ? [
            {
              title: t("Edytuj quiz", "Edit Quiz"),
              icon: "pencil" as const,
              onPress: () => go("/editor"),
            },
          ]
        : []),
      {
        title: t("Udostępnij", "Share"),
        icon: "square.and.arrow.up",
        onPress: () => go("/share"),
      },
      {
        title: t("Opinie i komentarze", "Reviews & Comments"),
        icon: "star.bubble",
        onPress: () => go("/community"),
      },
      {
        title: t("Utwórz kopię", "Make a Copy"),
        icon: "doc.on.doc",
        onPress: makeCopy,
      },
      ...(question && !complete
        ? [
            {
              title: t("Zgłoś problem", "Report Question"),
              icon: "exclamationmark.bubble" as const,
              onPress: () =>
                router.push({
                  pathname: "/report",
                  params: { id, question: question.id },
                }),
            },
          ]
        : []),
    ],
    [
      {
        title: t("Nowa sesja", "New Session"),
        icon: "arrow.counterclockwise",
        onPress: () => void restart(),
      },
      {
        title: t("Usuń lokalną kopię", "Remove Local Copy"),
        icon: "trash",
        destructive: true,
        onPress: removeLocalCopy,
      },
    ],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: quiz.title,
          // The browser preview has no native toolbar; it keeps the JS menu.
          ...(native
            ? {}
            : headerMenus(
                [
                  {
                    label: t("Opcje quizu", "Quiz options"),
                    icon: "ellipsis",
                    sections: menu,
                  },
                ],
                t,
              )),
        }}
      />
      {native ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon="ellipsis"
            accessibilityLabel={t("Opcje quizu", "Quiz options")}
          >
            {menu.map((group, index) => (
              <Stack.Toolbar.Menu key={index} inline title="">
                {group.map((item) => (
                  <Stack.Toolbar.MenuAction
                    key={item.title}
                    icon={item.icon}
                    destructive={item.destructive}
                    onPress={() =>
                      void Promise.resolve()
                        .then(item.onPress)
                        .catch((error: unknown) =>
                          notify(
                            failureTitle(t, item.title),
                            userError(error, t),
                          ),
                        )
                    }
                  >
                    {item.title}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      {native ? (
        // Icon buttons carry text titles: expo-router 57 drops toolbar
        // accessibilityLabel on iOS, while UIKit reads the title and shows the icon.
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Button
            icon="pencil"
            hidden={!quiz.can_edit || !question || complete}
            onPress={() =>
              question &&
              router.push({
                pathname: "/editor",
                params: { id, question: question.id },
              })
            }
          >
            {t("Edytuj to pytanie", "Edit This Question")}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Button
            icon={checked === null ? "lightbulb" : "sparkles"}
            hidden={!question || complete}
            onPress={() => question && showHint(question)}
          >
            {hintLabel}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Button
            icon="bubble.left.and.text.bubble.right"
            hidden={!question || complete}
            onPress={() => question && askAssistant(question)}
          >
            {t("Asystent", "Assistant")}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Button
            icon="chart.bar"
            hidden={!complete}
            onPress={() => go("/stats")}
          >
            {t("Wyniki", "Results")}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button
            variant="prominent"
            tintColor={c.prominent}
            hidden={!primary}
            disabled={primaryDisabled}
            onPress={() =>
              void Promise.resolve()
                .then(runPrimary)
                .catch((error: unknown) =>
                  notify(
                    failureTitle(
                      t,
                      primary ? primaryLabel[primary] : undefined,
                    ),
                    userError(error, t),
                  ),
                )
            }
          >
            {primary ? primaryLabel[primary] : ""}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 28,
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          gap: 14,
        }}
      >
        <View style={{ gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 13, color: c.muted }}>
              {t(
                `Opanowane: ${mastered} z ${total}`,
                `${mastered} of ${total} mastered`,
              )}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: c.muted,
                fontVariant: ["tabular-nums"],
              }}
              accessibilityLabel={t(
                `Czas nauki: ${studyTime}`,
                `Study time: ${studyTime}`,
              )}
            >
              {studyTime}
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: total, now: mastered }}
            style={{
              height: 4,
              backgroundColor: c.border,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${total ? (100 * mastered) / total : 0}%`,
                height: 4,
                borderRadius: 2,
                backgroundColor: c.primary,
              }}
            />
          </View>
        </View>
        <SyncStatus />
        {complete ? (
          <QuizCompleteCard quizId={id} total={total} studyTime={studyTime} />
        ) : question ? (
          <>
            <View style={{ gap: 12, paddingVertical: 8 }}>
              <RichText text={question.text} allowImages={images} size={21} />
              {question.image && images(question.image) ? (
                <StudyImage
                  key={question.image}
                  uri={question.image}
                  label={t("Ilustracja pytania", "Question image")}
                />
              ) : null}
              <ExternalImageNotice
                question={question}
                showExplanation={checked !== null}
                allowed={images}
                approve={(hosts) =>
                  setImageApproval((previous) => ({
                    scope: mediaScope,
                    hosts: [
                      ...new Set([
                        ...(previous?.scope === mediaScope
                          ? previous.hosts
                          : []),
                        ...hosts,
                      ]),
                    ],
                  }))
                }
              />
            </View>
            <HintScope
              question={question}
              mode={hint?.question === question.id ? hint.mode : null}
              attempt={hint?.attempt ?? 0}
            >
              {(ai) => (
                <>
                  <Text style={{ fontSize: 13, color: c.muted }}>
                    {question.multiple
                      ? t(
                          "Wybierz wszystkie poprawne odpowiedzi",
                          "Select all correct answers",
                        )
                      : t("Wybierz jedną odpowiedź", "Select one answer")}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {question.answers.map((answer, index) => {
                      const chosen = selected.includes(answer.id),
                        revealed = checked !== null;
                      const correct = revealed && answer.is_correct,
                        wrong = revealed && chosen && !answer.is_correct;
                      const accent = correct
                        ? c.success
                        : wrong
                          ? c.danger
                          : chosen
                            ? c.primary
                            : "transparent";
                      const answerHint = ai?.answers.get(index);
                      return (
                        <View key={answer.id}>
                          <PressableScale
                            testID={`study-answer-${answer.id}`}
                            accessibilityRole={
                              question.multiple ? "checkbox" : "radio"
                            }
                            accessibilityLabel={
                              answer.text ||
                              t("Odpowiedź obrazkowa", "Image answer")
                            }
                            accessibilityHint={
                              correct
                                ? t("Poprawna odpowiedź", "Correct answer")
                                : wrong
                                  ? t(
                                      "Twoja błędna odpowiedź",
                                      "Your incorrect answer",
                                    )
                                  : undefined
                            }
                            aria-checked={chosen}
                            aria-disabled={revealed || saving}
                            accessibilityState={{
                              checked: chosen,
                              disabled: revealed || saving,
                            }}
                            disabled={revealed || saving}
                            onPress={() => {
                              haptics.selection();
                              setSelected((current) =>
                                question.multiple
                                  ? current.includes(answer.id)
                                    ? current.filter((x) => x !== answer.id)
                                    : [...current, answer.id]
                                  : [answer.id],
                              );
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 12,
                              minHeight: 56,
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              borderRadius: 14,
                              borderCurve: "continuous",
                              borderWidth: 1.5,
                              borderColor: accent,
                              backgroundColor: correct
                                ? c.successBg
                                : wrong
                                  ? c.dangerBg
                                  : chosen
                                    ? c.tint
                                    : c.surface,
                              opacity: revealed && !correct && !wrong ? 0.6 : 1,
                            }}
                          >
                            <View
                              style={{ flex: 1, gap: 6 }}
                              pointerEvents="box-none"
                            >
                              <View pointerEvents="none">
                                <RichText
                                  text={answer.text}
                                  allowImages={images}
                                />
                              </View>
                              {answer.image && images(answer.image) ? (
                                <StudyImage
                                  key={answer.image}
                                  uri={answer.image}
                                  height={120}
                                  label={t(
                                    "Ilustracja odpowiedzi",
                                    "Answer image",
                                  )}
                                />
                              ) : null}
                              {correct && !chosen ? (
                                <Text
                                  style={{ fontSize: 12, color: c.success }}
                                >
                                  {t("Poprawna odpowiedź", "Correct answer")}
                                </Text>
                              ) : wrong ? (
                                <Text style={{ fontSize: 12, color: c.danger }}>
                                  {t("Twoja odpowiedź", "Your answer")}
                                </Text>
                              ) : null}
                            </View>
                            {/* Like most quiz apps, an answer shows a mark only once
                        chosen or revealed; the shape still says pick one or many. */}
                            {chosen || correct || wrong ? (
                              <OptionIndicator
                                selected={chosen}
                                multiple={question.multiple}
                                result={
                                  correct ? "correct" : wrong ? "wrong" : null
                                }
                              />
                            ) : (
                              <View style={{ width: 24 }} />
                            )}
                          </PressableScale>
                          {answerHint ? (
                            <AnswerHint
                              text={answerHint}
                              streaming={!!ai?.busy}
                            />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                  {checked !== null ? (
                    <View
                      accessibilityLiveRegion="polite"
                      accessibilityRole="alert"
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        padding: 14,
                        borderRadius: 14,
                        borderCurve: "continuous",
                        backgroundColor: checked ? c.successBg : c.dangerBg,
                      }}
                    >
                      <ResultIcon
                        result={checked ? "correct" : "wrong"}
                        size={26}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: checked ? c.success : c.danger,
                          }}
                        >
                          {checked
                            ? t("Dobrze!", "Correct!")
                            : t("Nie tym razem", "Not Quite")}
                        </Text>
                        {checked ? null : (
                          <Text style={{ fontSize: 14, color: c.text }}>
                            {t(
                              "To pytanie wróci później w tej sesji.",
                              "This question will come back later in the session.",
                            )}
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : null}
                  {ai && hint ? (
                    <InlineHint
                      mode={hint.mode}
                      state={ai}
                      onClose={() => setHint(null)}
                    />
                  ) : null}
                </>
              )}
            </HintScope>
            {checked !== null && question.explanation ? (
              <View
                style={{
                  gap: 8,
                  padding: 14,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  backgroundColor: c.surface,
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={{ fontSize: 15, fontWeight: "600", color: c.text }}
                >
                  {t("Wyjaśnienie", "Explanation")}
                </Text>
                <RichText text={question.explanation} allowImages={images} />
              </View>
            ) : null}
          </>
        ) : (
          <Label>
            {t(
              "Ten quiz nie ma jeszcze pytań.",
              "This quiz has no questions yet.",
            )}
          </Label>
        )}
      </ScrollView>
      {native ? null : (
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: c.surface,
            borderTopWidth: 0.5,
            borderColor: c.border,
            gap: 8,
          }}
        >
          {!complete && question ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {quiz.can_edit ? (
                <EditorAction
                  action="edit"
                  label={t("Edytuj to pytanie", "Edit This Question")}
                  onPress={() =>
                    router.push({
                      pathname: "/editor",
                      params: { id, question: question.id },
                    })
                  }
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Button kind="secondary" onPress={() => showHint(question)}>
                  {hintLabel}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button kind="secondary" onPress={() => askAssistant(question)}>
                  {t("Asystent", "Assistant")}
                </Button>
              </View>
            </View>
          ) : null}
          {complete ? (
            <Button kind="secondary" onPress={() => go("/stats")}>
              {t("Wyniki i historia sesji", "Results and Session History")}
            </Button>
          ) : null}
          {primary ? (
            <Button disabled={primaryDisabled} onPress={runPrimary}>
              {primaryLabel[primary]}
            </Button>
          ) : null}
        </View>
      )}
    </View>
  );
}

type StudyQuestion = NonNullable<ReturnType<typeof resolveCurrentQuestion>>;
type AiState = ReturnType<typeof useAiResponse>;

// The AI request only runs while a hint is open; hooks cannot be conditional.
function HintScope({
  question,
  mode,
  attempt,
  children,
}: {
  question: StudyQuestion;
  mode: "hint" | "explain" | null;
  attempt: number;
  children: (ai: AiState | null) => ReactNode;
}) {
  return mode ? (
    <ActiveHint
      key={`${question.id}:${mode}:${attempt}`}
      question={question}
      mode={mode}
    >
      {children}
    </ActiveHint>
  ) : (
    <>{children(null)}</>
  );
}

function ActiveHint({
  question,
  mode,
  children,
}: {
  question: StudyQuestion;
  mode: "hint" | "explain";
  children: (ai: AiState) => ReactNode;
}) {
  return <>{children(useAiResponse(question, mode))}</>;
}
