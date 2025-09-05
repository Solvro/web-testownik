import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { invariant } from "@/lib/invariant";

import type { Question, Quiz, Reoccurrence } from "../types";
import { initialRuntime, runtimeReducer } from "./quiz-runtime-reducer";
import type {
  Progress,
  UseQuizLogicParameters,
  UseQuizLogicResult,
  UserSettings,
} from "./types";
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
    userSettings: {
      sync_progress: false,
      initial_reoccurrences: 1,
      wrong_answer_reoccurrences: 1,
    },
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
    showBrainrot,
  } = runtime;

  const {
    studyTime,
    setFromLoaded: setTimer,
    startTimeRef,
  } = useStudyTimer(isQuizFinished, 0);

  // refs for continuity
  const currentQuestionRef = useRef<Question | null>(null);
  const reoccurrencesRef = useRef<Reoccurrence[]>([]);
  const wrongAnswersCountRef = useRef<number>(0);
  const correctAnswersCountRef = useRef<number>(0);
  const selectedAnswersRef = useRef<number[]>([]);

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
      try {
        const response = await appContext.axiosInstance.get<Quiz | null>(
          `/quizzes/${quizId}/`,
        );
        if (response.status === 200) {
          return response.data;
        }
      } catch {
        /* fallback below */
      }
      const userQuizzes = JSON.parse(
        localStorage.getItem("guest_quizzes") ?? "[]",
      ) as Quiz[];
      return userQuizzes.find((q) => q.id === quizId) ?? null;
    } catch {
      return null;
    }
  }

  async function fetchSettings(): Promise<UserSettings> {
    try {
      if (appContext.isGuest || !appContext.isAuthenticated) {
        const settingsText = localStorage.getItem("settings");
        if (settingsText != null && settingsText !== "") {
          const parsed: unknown = JSON.parse(settingsText);
          return parsed as UserSettings; // trusted local structure
        }
        return {
          sync_progress: false,
          initial_reoccurrences: 1,
          wrong_answer_reoccurrences: 1,
        } satisfies UserSettings;
      }
      const settingsResponse =
        await appContext.axiosInstance.get<UserSettings>("/settings/");
      if (settingsResponse.status === 200) {
        localStorage.setItem("settings", JSON.stringify(settingsResponse.data));
        return settingsResponse.data;
      }
    } catch {
      /* ignore */
    }
    const s = localStorage.getItem("settings");
    if (s != null && s !== "") {
      const parsed: unknown = JSON.parse(s);
      return parsed as UserSettings;
    }
    return {
      sync_progress: false,
      initial_reoccurrences: 1,
      wrong_answer_reoccurrences: 1,
    } satisfies UserSettings;
  }

  async function loadProgress(sync: boolean): Promise<Progress | null> {
    if (sync && appContext.isAuthenticated) {
      try {
        const progressResponse = await appContext.axiosInstance.get<Progress>(
          `/quiz/${quizId}/progress/`,
        );
        if (progressResponse.status === 200) {
          setTimer(
            progressResponse.data.study_time,
            Date.now() - progressResponse.data.study_time * 1000,
          );
          return progressResponse.data;
        }
      } catch {
        /* fallback */
      }
    }
    const stored = localStorage.getItem(`${quizId}_progress`);
    let parsed: Progress | null = null;
    if (stored != null && stored !== "") {
      parsed = JSON.parse(stored) as Progress;
    }
    if (parsed != null) {
      setTimer(parsed.study_time, Date.now() - parsed.study_time * 1000);
    }
    return parsed;
  }

  const saveProgress = useCallback(async () => {
    if (currentQuestionRef.current == null || isQuizFinished) {
      return;
    }
    const progress: Progress = {
      current_question: currentQuestionRef.current.id,
      correct_answers_count: correctAnswersCountRef.current,
      wrong_answers_count: wrongAnswersCountRef.current,
      study_time: studyTime,
      reoccurrences: reoccurrencesRef.current,
    };
    localStorage.setItem(`${quizId}_progress`, JSON.stringify(progress));
    if (
      userSettings.sync_progress &&
      appContext.isAuthenticated &&
      (continuity.isHost || continuity.peerConnections.length === 0)
    ) {
      try {
        await appContext.axiosInstance.post(
          `/quiz/${quizId}/progress/`,
          progress,
        );
      } catch {
        /* ignore */
      }
    }
  }, [
    appContext.axiosInstance,
    appContext.isAuthenticated,
    continuity.isHost,
    continuity.peerConnections.length,
    isQuizFinished,
    quizId,
    studyTime,
    userSettings.sync_progress,
  ]);

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
      const sorted = [...selectedQuestion.answers].sort(
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
    (quizData: Quiz, saved: Progress) => {
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
      const sorted = [...loadedSavedQuestion.answers].sort(
        () => Math.random() - 0.5,
      );
      dispatch({
        type: "SET_CURRENT_QUESTION",
        payload: { question: { ...loadedSavedQuestion, answers: sorted } },
      });
      if (!mergedReoccurrences.some((r) => r.reoccurrences > 0)) {
        dispatch({ type: "MARK_FINISHED" });
      }
    },
    [pickRandomQuestion, userSettings.initial_reoccurrences],
  );

  const checkAnswer = useCallback(
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

  const resetProgress = useCallback(async () => {
    localStorage.removeItem(`${quizId}_progress`);
    if (userSettings.sync_progress) {
      try {
        await appContext.axiosInstance.delete(`/quiz/${quizId}/progress/`);
      } catch {
        /* ignore */
      }
    }
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
    appContext.axiosInstance,
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
          pickRandomQuestion(_quiz, initialReoccurrences);
        }
        nextMetaQuiz = _quiz;
      }
      setMeta({
        quiz: nextMetaQuiz,
        loading: false,
        userSettings: nextSettings,
      });
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
