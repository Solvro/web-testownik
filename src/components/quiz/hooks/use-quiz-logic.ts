import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "react-toastify";

import { invariant } from "@/lib/invariant";
import type {
  Question,
  Quiz,
  QuizProgress,
  Reoccurrence,
} from "@/types/quiz.ts";
import type { UserSettings } from "@/types/user.ts";
import { DEFAULT_USER_SETTINGS } from "@/types/user.ts";

import { initialRuntime, runtimeReducer } from "./quiz-runtime-reducer";
import type { UseQuizLogicParameters, UseQuizLogicResult } from "./types";
import { useQuizContinuity } from "./use-quiz-continuity";
import { useStudyTimer } from "./use-study-timer";

export function useQuizLogic({
  quizId,
  appContext,
}: UseQuizLogicParameters): UseQuizLogicResult {
  const [meta, setMeta] = useState<{
    quiz: Quiz | null;
    loading: boolean;
    userSettings: UserSettings;
  }>({
    quiz: null,
    loading: true,
    userSettings: { ...DEFAULT_USER_SETTINGS },
  });
  const { quiz, loading, userSettings } = meta;

  const [runtime, dispatch] = useReducer(runtimeReducer, initialRuntime);

  const {
    currentQuestion,
    selectedAnswers,
    questionChecked,
    correctAnswersCount,
    wrongAnswersCount,
    reoccurrences,
    isQuizFinished,
    canGoBack,
    showBrainrot,
  } = runtime;

  const {
    studyTime,
    setFromLoaded: setTimer,
    startTimeRef,
  } = useStudyTimer(isQuizFinished, 0);

  // refs for continuity
  const initRef = useRef(false);
  const currentQuestionRef = useRef<Question | null>(null);
  const reoccurrencesRef = useRef<Reoccurrence[]>([]);
  const wrongAnswersCountRef = useRef<number>(0);
  const correctAnswersCountRef = useRef<number>(0);
  const selectedAnswersRef = useRef<number[]>([]);
  // [0]: previous, [1]: current
  const historyRef = useRef<{ question: Question; answers: number[] }[]>([]);

  // we need a ref indirection to avoid use-before-define for checkAnswer used by continuity
  // placeholder ref; will be assigned after checkAnswer creation
  const checkAnswerRef = useRef<(remote?: boolean) => void>(() => {
    /* noop until assigned */
  });

  // continuity hook (initialized after checkAnswer definition, but uses ref here)
  const continuity = useQuizContinuity({
    enabled: userSettings.sync_progress && appContext.isAuthenticated,
    quizId,
    getCurrentState: () => ({
      question: currentQuestionRef.current,
      reoccurrences: reoccurrencesRef.current,
      startTime: startTimeRef.current,
      wrongAnswers: wrongAnswersCountRef.current,
      correctAnswers: correctAnswersCountRef.current,
      selectedAnswers: selectedAnswersRef.current,
    }),
    onInitialSync: (d) => {
      startTimeRef.current = d.startTime;
      dispatch({
        type: "APPLY_LOADED_PROGRESS",
        payload: {
          reoccurrences: d.reoccurrences,
          question: null, // updated later via onQuestionUpdate
          correct: d.correctAnswersCount,
          wrong: d.wrongAnswersCount,
          finished: false,
        },
      });
    },
    onQuestionUpdate: (q, selected) => {
      dispatch({ type: "SET_CURRENT_QUESTION", payload: { question: q } });
      dispatch({ type: "SET_SELECTED_ANSWERS", payload: selected });
    },
    onAnswerChecked: () => {
      checkAnswerRef.current(true);
    },
  });

  // effects to keep refs updated
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    reoccurrencesRef.current = reoccurrences;
    wrongAnswersCountRef.current = wrongAnswersCount;
    correctAnswersCountRef.current = correctAnswersCount;
    selectedAnswersRef.current = selectedAnswers;
  }, [
    currentQuestion,
    reoccurrences,
    wrongAnswersCount,
    correctAnswersCount,
    selectedAnswers,
  ]);

  // fetch logic
  async function fetchQuiz(): Promise<Quiz | null> {
    try {
      invariant(quizId, "Quiz ID must be defined");
      return await appContext.services.quiz.getQuiz(quizId);
    } catch {
      return null;
    }
  }

  async function fetchSettings(): Promise<UserSettings> {
    try {
      return await appContext.services.user.getUserSettings();
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_USER_SETTINGS };
  }

  async function loadProgress(sync: boolean): Promise<QuizProgress | null> {
    return await appContext.services.quiz.getQuizProgress(quizId, sync);
  }

  const saveProgress = useCallback(async () => {
    if (currentQuestionRef.current == null || isQuizFinished) {
      return;
    }
    const progress: QuizProgress = {
      current_question: currentQuestionRef.current.id,
      correct_answers_count: correctAnswersCountRef.current,
      wrong_answers_count: wrongAnswersCountRef.current,
      study_time: studyTime,
      reoccurrences: reoccurrencesRef.current,
    };
    const syncToServer =
      userSettings.sync_progress &&
      appContext.isAuthenticated &&
      (continuity.isHost || continuity.peerConnections.length === 0);
    try {
      await appContext.services.quiz.setQuizProgress(
        quizId,
        progress,
        syncToServer,
      );
    } catch {
      toast.warning("Nie udało się zsynchronizować postępu quizu z serwerem.");
    }
  }, [
    appContext.services.quiz,
    appContext.isAuthenticated,
    continuity.isHost,
    continuity.peerConnections.length,
    isQuizFinished,
    quizId,
    studyTime,
    userSettings.sync_progress,
  ]);

  const addHistoryEntry = (question: Question, answers: number[]) => {
    historyRef.current.push({ question, answers });
    if (historyRef.current.length === 2) {
      dispatch({
        type: "MARK_CAN_GO_BACK",
      });
    }
    if (historyRef.current.length > 2) {
      historyRef.current.shift();
    }
  };

  const pickRandomQuestion = useCallback(
    (quizData: Quiz, availableReoccurrences: Reoccurrence[]) => {
      const validIds = new Set(quizData.questions.map((q) => q.id));
      const valid = availableReoccurrences.filter(
        (r) => validIds.has(r.id) && r.reoccurrences > 0,
      );
      if (valid.length === 0) {
        dispatch({ type: "MARK_FINISHED" });
        currentQuestionRef.current = null;
        void saveProgress();
        return null;
      }
      const randId = valid[Math.floor(Math.random() * valid.length)].id;
      const selectedQuestion = quizData.questions.find((q) => q.id === randId);
      if (selectedQuestion == null) {
        return null;
      }
      const sorted = [...selectedQuestion.answers].toSorted(
        () => Math.random() - 0.5,
      );
      const randomizedQuestion = { ...selectedQuestion, answers: sorted };
      dispatch({
        type: "SET_CURRENT_QUESTION",
        payload: { question: randomizedQuestion },
      });
      currentQuestionRef.current = randomizedQuestion;
      void saveProgress();
      return randomizedQuestion;
    },
    [saveProgress],
  );

  const applyLoadedProgress = useCallback(
    (quizData: Quiz, saved: QuizProgress) => {
      const validIds = new Set(quizData.questions.map((q) => q.id));
      const filtered = saved.reoccurrences.filter((r) => validIds.has(r.id));
      const existingIds = new Set(filtered.map((r) => r.id));
      const initialReoccurrences = quizData.questions
        .filter((q) => !existingIds.has(q.id))
        .map((q) => ({
          id: q.id,
          reoccurrences: userSettings.initial_reoccurrences,
        }));
      // it's possible that quiz has changed and some reoccurrences are now for invalid questions or there are new questions
      const mergedReoccurrences = [...filtered, ...initialReoccurrences];
      dispatch({
        type: "APPLY_LOADED_PROGRESS",
        payload: {
          reoccurrences: mergedReoccurrences,
          question: null, // will be set below
          correct: saved.correct_answers_count,
          wrong: saved.wrong_answers_count,
          finished: !mergedReoccurrences.some((r) => r.reoccurrences > 0),
        },
      });
      const loadedSavedQuestion = quizData.questions.find(
        (q) => q.id === saved.current_question,
      );
      if (loadedSavedQuestion == null) {
        pickRandomQuestion(quizData, mergedReoccurrences);
        return;
      }
      const sorted = [...loadedSavedQuestion.answers].toSorted(
        () => Math.random() - 0.5,
      );
      dispatch({
        type: "SET_CURRENT_QUESTION",
        payload: { question: { ...loadedSavedQuestion, answers: sorted } },
      });
      if (!initRef.current) {
        addHistoryEntry(loadedSavedQuestion, []);
      }
      if (!mergedReoccurrences.some((r) => r.reoccurrences > 0)) {
        dispatch({ type: "MARK_FINISHED" });
      }
      setTimer(saved.study_time, Date.now() - saved.study_time * 1000);
    },
    [pickRandomQuestion, setTimer, userSettings.initial_reoccurrences],
  );

  const checkAnswer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-useless-default-assignment
    (remote = false) => {
      if (questionChecked || currentQuestionRef.current == null) {
        return;
      }
      dispatch({
        type: "CHECK_ANSWER",
        payload: {
          selectedAnswers,
          wrongAnswerReoccurrences: userSettings.wrong_answer_reoccurrences,
        },
      });
      if (!remote) {
        continuity.sendAnswerChecked();
      }
    },
    [
      continuity,
      questionChecked,
      selectedAnswers,
      userSettings.wrong_answer_reoccurrences,
    ],
  );

  useEffect(() => {
    checkAnswerRef.current = checkAnswer;
  }, [checkAnswer]);

  const nextQuestion = useCallback(() => {
    if (quiz == null) {
      return;
    }
    const randomizedQuestion = pickRandomQuestion(quiz, reoccurrences);
    dispatch({
      type: "SET_CURRENT_QUESTION",
      payload: { question: randomizedQuestion },
    });
    if (randomizedQuestion != null) {
      addHistoryEntry(randomizedQuestion, []);
      continuity.sendQuestionUpdate(randomizedQuestion, []);
    }
  }, [continuity, pickRandomQuestion, quiz, reoccurrences]);

  const nextAction = useCallback(() => {
    if (questionChecked) {
      nextQuestion();
    } else {
      checkAnswer();
    }
  }, [checkAnswer, nextQuestion, questionChecked]);

  const goBack = useCallback(() => {
    if (historyRef.current.length < 2) {
      return;
    }
    console.log(historyRef.current);
  }, []);

  const resetProgress = useCallback(async () => {
    await appContext.services.quiz.deleteQuizProgress(
      quizId,
      userSettings.sync_progress,
    );
    if (quiz != null) {
      const initialReoccurrences = quiz.questions.map((q) => ({
        id: q.id,
        reoccurrences: userSettings.initial_reoccurrences,
      }));
      dispatch({
        type: "RESET_PROGRESS",
        payload: { reoccurrences: initialReoccurrences, question: null },
      });
      setTimer(0, Date.now());
      pickRandomQuestion(quiz, initialReoccurrences);
    }
  }, [
    appContext.services.quiz,
    pickRandomQuestion,
    quiz,
    quizId,
    userSettings.initial_reoccurrences,
    userSettings.sync_progress,
    setTimer,
  ]);

  // initial load
  useEffect(() => {
    void (async () => {
      const _quiz = await fetchQuiz();
      let nextMetaQuiz: Quiz | null = null;
      let nextSettings = meta.userSettings;
      if (_quiz != null) {
        document.title = `${_quiz.title} - Testownik Solvro`;
        nextSettings = await fetchSettings();
        const saved = await loadProgress(nextSettings.sync_progress);
        if (saved != null && saved.current_question !== 0) {
          applyLoadedProgress(_quiz, saved);
        } else {
          const initialReoccurrences = _quiz.questions.map((qq) => ({
            id: qq.id,
            reoccurrences: nextSettings.initial_reoccurrences,
          }));
          dispatch({
            type: "INIT_REOCCURRENCES",
            payload: { reoccurrences: initialReoccurrences },
          });
          const randomQuestion = pickRandomQuestion(
            _quiz,
            initialReoccurrences,
          );
          if (randomQuestion != null) {
            addHistoryEntry(randomQuestion, selectedAnswers);
          }
        }
        nextMetaQuiz = _quiz;
      }
      setMeta({
        quiz: nextMetaQuiz,
        loading: false,
        userSettings: nextSettings,
      });
      initRef.current = true;
    })();
    // we only want to run this once on mount or when auth state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appContext.isAuthenticated]);

  return {
    loading,
    quiz,
    userSettings,
    state: {
      currentQuestion,
      selectedAnswers,
      questionChecked,
      isQuizFinished,
      canGoBack,
      showBrainrot,
    },
    stats: {
      correctAnswersCount,
      wrongAnswersCount,
      reoccurrences,
      studyTime,
    },
    continuity: {
      isHost: continuity.isHost,
      peerConnections: continuity.peerConnections,
    },
    actions: {
      nextAction,
      nextQuestion,
      goBack,
      resetProgress,
      setSelectedAnswers: (ans: number[]) => {
        selectedAnswersRef.current = ans;
        dispatch({ type: "SET_SELECTED_ANSWERS", payload: ans });
        if (currentQuestion != null) {
          continuity.sendQuestionUpdate(currentQuestion, ans);
        }
      },
      toggleBrainrot: () => {
        dispatch({ type: "TOGGLE_BRAINROT" });
      },
    },
  } as const;
}
