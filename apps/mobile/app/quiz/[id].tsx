import type {
  AnswerRecord,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import {
  checkAnswerCorrectness,
  deriveSettings,
  ensureQuizCurrentQuestion,
  getMasteredCount,
  isQuizComplete,
  pickNextQuestion,
  resolveCurrentQuestion,
} from "@testownik/core/quiz/session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import {
  Stack,
  router,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Card,
  ErrorScreen,
  Label,
  Loading,
  Screen,
  notify,
  useConfirm,
} from "../../src/components/ui";
import { api as sessionApi, API_URL } from "../../src/lib/api";
import { haptics } from "../../src/lib/haptics";
import { createCompletionAnnouncement } from "../../src/lib/accessibility-feedback";
import { removeQuizImages, saveQuizImages } from "../../src/lib/offline-images";
import {
  failureTitle,
  errorKind,
  userError,
  UserFacingError,
} from "../../src/lib/user-error";
import { ApiError } from "../../src/lib/client";
import QuizCompleteCard from "../../src/components/QuizCompleteCard";
import { useSession } from "../../src/lib/session";
import { useTheme } from "../../src/lib/theme";
import QuizStorageNotice from "../../src/components/QuizStorageNotice";
import {
  quizStorageIssue,
  quizStorageMessage,
  type QuizStorageIssue,
} from "../../src/lib/quiz-storage-issue";
import { isLocalQuery, markLocalQuery } from "../../src/lib/saved-query";
import { useRefreshOnRecovery } from "../../src/lib/use-refresh-on-recovery";

// Normalize once when query data arrives, so answer selections cannot cause a
// null/deleted current question to be picked again during render.
const pinQuestion = (quiz: QuizWithUserProgress) =>
  quiz.current_session
    ? ensureQuizCurrentQuestion(quiz, deriveSettings(quiz.user_settings))
    : quiz;

// Query-only metadata: symbols are omitted by JSON when answers are persisted.
const savedCopy = Symbol("saved-copy-updates-unavailable");
const storageCopy = Symbol("saved-copy-storage-issue");
type StudyQuiz = QuizWithUserProgress & {
  [savedCopy]?: true;
  [storageCopy]?: QuizStorageIssue;
};
const fromSavedCopy = (
  quiz: QuizWithUserProgress | undefined,
  issue?: QuizStorageIssue,
) =>
  quiz
    ? {
        ...markLocalQuery(pinQuestion(quiz)),
        [savedCopy]: true as const,
        ...(issue ? { [storageCopy]: issue } : {}),
      }
    : undefined;

// Event handlers and effects only; reading the clock during render is impure.
const clock = () => Date.now();

export default function Study() {
  const navigation = useNavigation();
  const [api] = useState(() => sessionApi.forSession());
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
  const [enqueueStorage, setEnqueueStorage] = useState<{
    scope: string;
    issue: QuizStorageIssue;
  } | null>(null);
  const feedbackScope = useRef<AbortController | null>(null);
  const copyPending = useRef<AbortSignal | null>(null);
  const [copying, setCopying] = useState<{
    scope: string;
    signal: AbortSignal;
  } | null>(null);
  const copyBusy = copying?.scope === mediaScope && !copying.signal.aborted;
  useEffect(() => {
    const controller = new AbortController();
    feedbackScope.current = controller;
    return () => controller.abort();
  }, [mediaScope]);
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
    // Structural sharing ignores symbol properties and could keep an obsolete
    // notice after an otherwise identical server response succeeds.
    structuralSharing: false,
    retry: (count, error) =>
      count < 1 &&
      !quizStorageIssue(error) &&
      !["timeout", "notFound", "forbidden", "signIn"].includes(
        errorKind(error),
      ),
    queryFn: async ({ signal }) => {
      const cached = await s.library!.read();
      const previous = qc.getQueryData<StudyQuiz>(["quiz", id, s.user?.id]);
      if (s.offline && cached.quizzes[id])
        return previous?.[savedCopy]
          ? fromSavedCopy(cached.quizzes[id], previous?.[storageCopy])
          : markLocalQuery(pinQuestion(cached.quizzes[id]));
      if (cached.queue.some((x) => x.quiz_id === id))
        return previous?.[savedCopy]
          ? fromSavedCopy(cached.quizzes[id], previous?.[storageCopy])
          : cached.quizzes[id] &&
              markLocalQuery(pinQuestion(cached.quizzes[id]));
      const snapshot = s.library!.captureSnapshot(id, cached);
      let incoming: QuizWithUserProgress | undefined;
      try {
        const q = await api.request<QuizWithUserProgress>(
          `quizzes/${id}/?include=user_settings,current_session`,
          // A saved quiz remains usable on a connection that accepts requests
          // but never responds. Keep the full deadline for first-time downloads.
          {
            signal,
            timeoutMs: cached.quizzes[id]?.current_session ? 4000 : undefined,
          },
        );
        const normalized = pinQuestion(q);
        incoming = normalized;
        const retained = await s.library!.cache(normalized, snapshot);
        if (!retained) throw new UserFacingError("operation");
        void saveQuizImages(retained);
        // A local mutation may have prevented this response from replacing the
        // saved quiz. Keep its status until an authoritative refresh is applied.
        return retained !== normalized && previous?.[savedCopy]
          ? fromSavedCopy(retained, previous?.[storageCopy])
          : retained !== normalized
            ? markLocalQuery(retained)
            : retained;
      } catch (e) {
        if (signal.aborted) throw e;
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
          // Deleted, trashed or unshared: stop offering it on this device.
          if (e.status !== 401 && cached.quizzes[id]) {
            // A local answer may have been saved while this GET was in flight.
            // remove() refuses to erase it; discard() would lose that answer.
            await s.library!.remove(id).catch(() => undefined);
            void qc.invalidateQueries({ queryKey: ["offline"] });
            void qc.invalidateQueries({ queryKey: ["recent"] });
          }
          throw e;
        }
        const latest = await s.library!.read();
        const storage = quizStorageIssue(e);
        if (storage && latest.quizzes[id])
          return fromSavedCopy(latest.quizzes[id], {
            ...storage,
            stale:
              !!incoming && incoming.version !== latest.quizzes[id].version,
          });
        if (latest.quizzes[id])
          return fromSavedCopy(
            latest.quizzes[id],
            previous?.[storageCopy]?.stale ? previous[storageCopy] : undefined,
          );
        throw e;
      }
    },
  });
  const currentQuestion = useMemo(
    () =>
      query.data
        ? resolveCurrentQuestion(
            query.data,
            deriveSettings(query.data.user_settings),
          )
        : null,
    [query.data],
  );
  const answerAttempt = useRef(0);
  const [answerImageRecovery, setAnswerImageRecovery] = useState({
    generation: 0,
    scope: "",
    failed: false,
  });
  const [answerDocumentRecovery, setAnswerDocumentRecovery] = useState({
    generation: 0,
    scope: "",
    failed: false,
  });
  const answerImageScope = JSON.stringify([
    mediaScope,
    query.data?.current_session?.id,
    (result?.question ?? currentQuestion)?.id,
  ]);
  const activeAnswerImageScope = useRef<string | null>(null);
  if (
    answerImageRecovery.scope &&
    answerImageRecovery.scope !== answerImageScope
  ) {
    setAnswerImageRecovery((previous) => ({
      ...previous,
      scope: "",
      failed: false,
    }));
  }
  if (
    answerDocumentRecovery.scope &&
    answerDocumentRecovery.scope !== answerImageScope
  ) {
    setAnswerDocumentRecovery((previous) => ({
      ...previous,
      scope: "",
      failed: false,
    }));
  }
  useLayoutEffect(() => {
    activeAnswerImageScope.current = answerImageScope;
    return () => {
      activeAnswerImageScope.current = null;
    };
  }, [answerImageScope]);
  const announcedAnswerImage = useRef<string | null>(null);
  useEffect(() => {
    if (
      !answerImageRecovery.failed ||
      answerImageRecovery.scope !== answerImageScope
    ) {
      announcedAnswerImage.current = null;
      return;
    }
    const signature = JSON.stringify([
      answerImageScope,
      answerImageRecovery.generation,
    ]);
    if (
      Platform.OS === "ios" &&
      navigation.isFocused() &&
      announcedAnswerImage.current !== signature
    ) {
      announcedAnswerImage.current = signature;
      createCompletionAnnouncement(feedbackScope.current?.signal)(
        t(
          "Nie udało się wczytać obrazu w odpowiedzi. Możesz wczytać obrazy ponownie.",
          "An image in an answer could not be loaded. You can reload the answer images.",
        ),
      );
    }
  }, [
    answerImageRecovery.failed,
    answerImageRecovery.scope,
    answerImageRecovery.generation,
    answerImageScope,
    navigation,
    t,
  ]);
  const announcedAnswerDocument = useRef<string | null>(null);
  useEffect(() => {
    if (
      !answerDocumentRecovery.failed ||
      answerDocumentRecovery.scope !== answerImageScope
    ) {
      announcedAnswerDocument.current = null;
      return;
    }
    const signature = JSON.stringify([
      answerImageScope,
      answerDocumentRecovery.generation,
    ]);
    if (
      Platform.OS === "ios" &&
      navigation.isFocused() &&
      announcedAnswerDocument.current !== signature
    ) {
      announcedAnswerDocument.current = signature;
      createCompletionAnnouncement(feedbackScope.current?.signal)(
        t(
          "Nie udało się wyświetlić formatowania odpowiedzi. Treść jest dostępna jako tekst. Możesz wczytać odpowiedzi ponownie.",
          "Answer formatting could not be displayed. The content is available as text. You can reload the answers.",
        ),
      );
    }
  }, [
    answerDocumentRecovery.failed,
    answerDocumentRecovery.scope,
    answerDocumentRecovery.generation,
    answerImageScope,
    navigation,
    t,
  ]);
  const quizData = query.data;
  useEffect(() => {
    if (quizData && !s.offline) void saveQuizImages(quizData);
  }, [quizData, s.offline]);
  const refetchQuiz = query.refetch;
  const refreshQuiz = useCallback(async () => {
    if (working.current) return;
    const attempt = answerAttempt.current;
    const signal = feedbackScope.current?.signal;
    const before = quizData;
    const refreshed = await refetchQuiz();
    // Check may have started while this GET was in flight. Keep that feedback's
    // selected answers even if the saved session now points at another question.
    if (
      signal?.aborted ||
      attempt !== answerAttempt.current ||
      !before ||
      !refreshed.data
    )
      return;
    if (
      refreshed.isSuccess &&
      refreshed.data !== before &&
      !isLocalQuery(refreshed.data)
    )
      setEnqueueStorage(null);
    const nextQuestion = resolveCurrentQuestion(
      refreshed.data,
      deriveSettings(refreshed.data.user_settings),
    );
    if (
      refreshed.data.version !== before.version ||
      nextQuestion?.id !== currentQuestion?.id
    )
      setSelected([]);
    else
      setSelected((values) =>
        values.filter((value) =>
          nextQuestion?.answers.some((answer) => answer.id === value),
        ),
      );
  }, [quizData, refetchQuiz, currentQuestion?.id]);
  useRefreshOnRecovery({
    scope: mediaScope,
    offline: s.offline,
    pending: s.pending,
    local: isLocalQuery(query.data),
    enabled:
      !!s.library &&
      !!query.data &&
      !query.isFetching &&
      !saving &&
      !result &&
      !hint,
    refresh: refreshQuiz,
  });
  const syncState = useQuery({
    queryKey: [
      "quiz-sync",
      id,
      s.user?.id,
      s.pending,
      s.syncError instanceof Error ? s.syncError.message : s.syncError,
    ],
    enabled: !!s.library,
    networkMode: "always",
    // A previously used count/error key may still hold a resolved conflict.
    // Re-read storage immediately when sync moves back to that key.
    staleTime: 0,
    queryFn: async () => (await s.library!.read()).errors[id] ?? null,
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
    const before = query.data;
    try {
      await api.post(`quizzes/${id}/restore/`);
      haptics.success();
      void qc.invalidateQueries({ queryKey: ["library"] });
      const refreshed = await query.refetch();
      if (
        refreshed.isSuccess &&
        refreshed.data &&
        refreshed.data !== before &&
        !isLocalQuery(refreshed.data)
      )
        setEnqueueStorage(null);
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
  const loadStorageIssue = quizStorageIssue(query.error);
  if (query.error || !query.data)
    return (
      <ErrorScreen
        retry={
          loadStorageIssue?.fitsAlone === false
            ? undefined
            : () => void query.refetch()
        }
        title={
          loadStorageIssue
            ? t("Nie można zapisać quizu", "Can’t Save Quiz")
            : undefined
        }
        error={
          loadStorageIssue
            ? new Error(quizStorageMessage(loadStorageIssue, t))
            : query.error
        }
        actions={
          // Your own quiz in the trash can come straight back.
          loadStorageIssue
            ? [
                {
                  label:
                    loadStorageIssue.fitsAlone === false
                      ? t("Przeglądaj bibliotekę", "Browse Library")
                      : t(
                          "Zarządzaj zapisanymi quizami",
                          "Manage Saved Quizzes",
                        ),
                  onPress: () =>
                    loadStorageIssue.fitsAlone === false
                      ? router.navigate("/library")
                      : router.push("/downloads"),
                },
              ]
            : query.error instanceof ApiError &&
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
    question = result?.question ?? currentQuestion,
    mastered = getMasteredCount(quiz.questions, answers, settings);
  const cachedStorage = (quiz as StudyQuiz)[storageCopy];
  const failedSaveStorage =
    enqueueStorage?.scope === mediaScope ? enqueueStorage.issue : null;
  const displayedStorage = cachedStorage?.stale
    ? cachedStorage
    : (failedSaveStorage ?? cachedStorage);
  async function submit() {
    if (!question || working.current) return;
    if (
      qc.getQueryData<StudyQuiz>(["quiz", id, s.user?.id])?.[storageCopy]?.stale
    ) {
      notify(
        t("Nie można zapisać odpowiedzi", "Can’t Save Answer"),
        userError(new UserFacingError("quizRefresh"), t),
      );
      return;
    }
    if (!session) {
      notify(
        t("Nie można zapisać odpowiedzi", "Can’t Save Answer"),
        t(
          "Sesja nauki jest niedostępna. Wczytaj quiz ponownie i spróbuj jeszcze raz.",
          "This study session is unavailable. Reload the quiz and try again.",
        ),
      );
      void query.refetch();
      return;
    }
    answerAttempt.current++;
    working.current = true;
    setSaving(true);
    const feedbackSignal = feedbackScope.current?.signal;
    const announce = createCompletionAnnouncement(feedbackSignal);
    let progressChanged = false;
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
          study_time: (session.study_time ?? 0) + elapsed,
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
      setEnqueueStorage(null);
      if (correct) haptics.success();
      else haptics.error();
      setResult({ question, correct });
      // Android/web already announce the result through its live region.
      if (Platform.OS === "ios" && feedbackSignal && navigation.isFocused())
        announce(
          correct
            ? t("Dobrze!", "Correct!")
            : t(
                "Nie tym razem. To pytanie wróci później w tej sesji.",
                "Not Quite. This question will come back later in the session.",
              ),
        );
      void s.sync().finally(() => syncState.refetch());
    } catch (error) {
      progressChanged =
        error instanceof UserFacingError &&
        error.code === "quizProgressChanged";
      // A rejection can arrive between the last render and this tap.
      if (error instanceof UserFacingError && error.code === "syncConflict")
        void syncState.refetch();
      const storage = quizStorageIssue(error);
      if (storage && !feedbackSignal?.aborted)
        setEnqueueStorage({ scope: mediaScope, issue: storage });
      // The selection stays, so checking again retries.
      haptics.error();
      notify(
        t("Nie zapisano odpowiedzi", "Couldn’t Save Answer"),
        storage ? quizStorageMessage(storage, t) : userError(error, t),
      );
    } finally {
      working.current = false;
      setSaving(false);
    }
    // Refresh only after the submit guard is released. The existing refresh
    // preserves selected choices when the saved question has not changed.
    if (progressChanged && !feedbackSignal?.aborted) void refreshQuiz();
  }
  async function next() {
    const state = await s.library!.read();
    qc.setQueryData(
      ["quiz", id, s.user?.id],
      (query.data as StudyQuiz)[savedCopy]
        ? fromSavedCopy(
            state.quizzes[id],
            (query.data as StudyQuiz)[storageCopy],
          )
        : state.quizzes[id],
    );
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
      setEnqueueStorage(null);
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
  const askAssistant = (target: NonNullable<typeof question>) => {
    setHint(null);
    router.push({
      pathname: "/ai",
      params: {
        id,
        question: target.id,
        answerOrder: JSON.stringify(target.answers.map((a) => a.id)),
      },
    });
  };
  const makeCopy = async () => {
    const signal = feedbackScope.current?.signal;
    if (!signal || signal.aborted || copyPending.current === signal) return;
    copyPending.current = signal;
    setCopying({ scope: mediaScope, signal });
    try {
      const copy = await api.post<{ id: string }>(`quizzes/${id}/copy/`);
      if (!signal.aborted)
        router.push({ pathname: "/editor", params: { id: copy.id } });
    } catch (error) {
      if (!signal.aborted) throw error;
    } finally {
      if (copyPending.current === signal) copyPending.current = null;
      if (!signal.aborted)
        setCopying((current) => (current?.signal === signal ? null : current));
    }
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
        void qc.invalidateQueries({ queryKey: ["offline"] });
        void s.sync();
        setEnqueueStorage(null);
        await syncState.refetch();
        await removeQuizImages(quiz);
        setResult(null);
        setHint(null);
        setSelected([]);
        await query.refetch();
      },
      { action: t("Usuń", "Remove") },
    );
  const complete = done && checked === null;
  const requestRestart = () => {
    if (!done && answers.length > 0)
      confirm(
        t("Rozpocząć nową sesję?", "Start a New Session?"),
        t(
          "Bieżąca sesja zostanie zakończona. Nowa sesja rozpocznie się bez odpowiedzi. Niezsynchronizowane odpowiedzi trzeba najpierw zsynchronizować.",
          "Your current session will end. The new session starts with no answers. Unsynced answers must sync first.",
        ),
        restart,
        { action: t("Nowa sesja", "New Session") },
      );
    else void restart();
  };
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
    (primary === "check" || primary === "restart") &&
    (saving ||
      !!syncState.data ||
      (primary === "check" && !!cachedStorage?.stale));
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
        title: t("Model AI", "AI Model"),
        icon: "sparkles",
        onPress: () => {
          setHint(null);
          router.push({ pathname: "/settings-model", params: { quiz: id } });
        },
      },
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
        title: copyBusy
          ? t("Tworzenie kopii…", "Creating Copy…")
          : t("Utwórz kopię", "Make a Copy"),
        icon: "doc.on.doc",
        onPress: makeCopy,
        disabled: copyBusy,
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
        onPress: requestRestart,
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
                    disabled={item.disabled}
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
          {displayedStorage ? (
            <QuizStorageNotice
              issue={displayedStorage}
              retry={
                !failedSaveStorage || cachedStorage?.stale
                  ? refreshQuiz
                  : undefined
              }
              disabled={saving || !!result || query.isFetching}
            />
          ) : null}
          {(query.data as StudyQuiz)[savedCopy] &&
          !displayedStorage &&
          !s.offline &&
          !s.pending &&
          !s.syncError &&
          !syncState.data ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted }}>
                {t(
                  "Zapisana kopia. Nie udało się odświeżyć quizu.",
                  "Saved copy. Couldn’t refresh this quiz.",
                )}
              </Text>
              <Button
                kind="secondary"
                disabled={saving || !!result || query.isFetching}
                onPress={refreshQuiz}
              >
                {t("Sprawdź aktualizacje", "Retry Updates")}
              </Button>
            </View>
          ) : null}
        </View>
        {!syncState.data ? <SyncStatus /> : null}
        {syncState.data ? (
          <Card>
            <Label>
              {t("Odpowiedzi wymagają uwagi", "Answers Need Attention")}
            </Label>
            <Label>{userError(new UserFacingError("syncConflict"), t)}</Label>
            <Button
              kind="secondary"
              onPress={async () => {
                await s.sync();
                await syncState.refetch();
              }}
            >
              {t("Ponów synchronizację", "Retry Sync")}
            </Button>
            <Button kind="danger" onPress={removeLocalCopy}>
              {t("Usuń lokalną kopię", "Remove Local Copy")}
            </Button>
          </Card>
        ) : null}
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
              quizId={id}
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
                                  key={answerImageScope}
                                  text={answer.text}
                                  allowImages={images}
                                  passiveImages
                                  documentGeneration={
                                    answerDocumentRecovery.generation
                                  }
                                  onDocumentFailure={() => {
                                    if (
                                      activeAnswerImageScope.current !==
                                      answerImageScope
                                    )
                                      return;
                                    setAnswerDocumentRecovery((previous) =>
                                      previous.generation !==
                                        answerDocumentRecovery.generation ||
                                      (previous.failed &&
                                        previous.scope === answerImageScope)
                                        ? previous
                                        : {
                                            ...previous,
                                            scope: answerImageScope,
                                            failed: true,
                                          },
                                    );
                                  }}
                                  retryGeneration={
                                    answerImageRecovery.generation
                                  }
                                  onImageFailure={() => {
                                    if (
                                      activeAnswerImageScope.current !==
                                      answerImageScope
                                    )
                                      return;
                                    setAnswerImageRecovery((previous) =>
                                      previous.generation !==
                                        answerImageRecovery.generation ||
                                      (previous.failed &&
                                        previous.scope === answerImageScope)
                                        ? previous
                                        : {
                                            ...previous,
                                            scope: answerImageScope,
                                            failed: true,
                                          },
                                    );
                                  }}
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
                  {answerImageRecovery.scope === answerImageScope &&
                  !(
                    answerDocumentRecovery.scope === answerImageScope &&
                    answerDocumentRecovery.failed
                  ) ? (
                    <View style={{ gap: 8 }}>
                      {answerImageRecovery.failed ? (
                        <Text
                          accessibilityRole="alert"
                          accessibilityLiveRegion="polite"
                          style={{ color: c.muted }}
                        >
                          {t(
                            "Nie udało się wczytać obrazu w odpowiedzi.",
                            "An image in an answer could not be loaded.",
                          )}
                        </Text>
                      ) : null}
                      <Button
                        kind="secondary"
                        testID="retry-answer-images"
                        onPress={() =>
                          setAnswerImageRecovery((previous) => ({
                            generation: previous.generation + 1,
                            scope: answerImageScope,
                            failed: false,
                          }))
                        }
                      >
                        {t(
                          "Wczytaj ponownie obrazy odpowiedzi",
                          "Reload Answer Images",
                        )}
                      </Button>
                    </View>
                  ) : null}
                  {answerDocumentRecovery.scope === answerImageScope ? (
                    <View style={{ gap: 8 }}>
                      {answerDocumentRecovery.failed ? (
                        <Text
                          accessibilityRole="alert"
                          accessibilityLiveRegion="polite"
                          style={{ color: c.muted }}
                        >
                          {t(
                            "Formatowanie odpowiedzi jest niedostępne. Treść jest dostępna jako tekst.",
                            "Answer formatting is unavailable. The content is available as text.",
                          )}
                        </Text>
                      ) : null}
                      <Button
                        kind="secondary"
                        testID="retry-answer-content"
                        onPress={() => {
                          setAnswerImageRecovery((previous) => ({
                            ...previous,
                            scope: "",
                            failed: false,
                          }));
                          setAnswerDocumentRecovery((previous) => ({
                            generation: previous.generation + 1,
                            scope: answerImageScope,
                            failed: false,
                          }));
                        }}
                      >
                        {t("Wczytaj ponownie odpowiedzi", "Reload Answers")}
                      </Button>
                    </View>
                  ) : null}
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
  quizId,
  question,
  mode,
  attempt,
  children,
}: {
  quizId: string;
  question: StudyQuestion;
  mode: "hint" | "explain" | null;
  attempt: number;
  children: (ai: AiState | null) => ReactNode;
}) {
  return mode ? (
    <ActiveHint
      key={`${question.id}:${mode}:${attempt}`}
      question={question}
      quizId={quizId}
      mode={mode}
    >
      {children}
    </ActiveHint>
  ) : (
    <>{children(null)}</>
  );
}

function ActiveHint({
  quizId,
  question,
  mode,
  children,
}: {
  quizId: string;
  question: StudyQuestion;
  mode: "hint" | "explain";
  children: (ai: AiState) => ReactNode;
}) {
  return <>{children(useAiResponse(question, mode, quizId))}</>;
}
