import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { invariant } from "@/lib/invariant";
import {
  checkAnswerCorrectness,
  getMasteredCount,
  pickNextQuestion,
} from "@/lib/session-utils";
import type {
  AnswerRecord,
  Question,
  Quiz,
  QuizSession,
} from "@/types/quiz.ts";
import type { UserSettings } from "@/types/user.ts";
import { DEFAULT_USER_SETTINGS } from "@/types/user.ts";

import {
  createAnswerRecord,
  initialRuntime,
  runtimeReducer,
  selectAnswerCounts,
} from "./quiz-runtime-reducer";
import type { UseQuizLogicParameters, UseQuizLogicResult } from "./types";
import { useQuizContinuity } from "./use-quiz-continuity";
import type { HistoryEntry } from "./use-quiz-history";
import { useQuizHistory } from "./use-quiz-history";
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
    isQuizFinished,
    isHistoryQuestion,
    showHistory,
    showBrainrot,
    answers,
    questions,
    settings,
  } = runtime;

  const {
    studyTime,
    setFromLoaded: setTimer,
    startTimeRef,
  } = useStudyTimer(isQuizFinished, 0);

  // Quiz history
  const { history, state, actions } = useQuizHistory({ quizId });
  const { canGoBack } = state;
  const { addHistoryEntry, setCurrentHistoryQuestion, clearHistory } = actions;

  // refs for continuity
  const currentQuestionRef = useRef<Question | null>(null);
  const answersRef = useRef<AnswerRecord[]>([]);
  const selectedAnswersRef = useRef<string[]>([]);
  const isHistoryQuestionRef = useRef<boolean>(false);

  // refs for continuity
  const checkAnswerRef = useRef<
    (remote?: boolean, nextQuestion?: Question | null) => void
  >(() => {
    /* noop until assigned */
  });

  // Compute stats from answers
  const answerCounts = selectAnswerCounts(runtime);
  const mastered = getMasteredCount(questions, answers, settings);

  // continuity hook
  const continuity = useQuizContinuity({
    enabled: userSettings.sync_progress && appContext.isAuthenticated,
    quizId,
    getCurrentState: () => ({
      question: currentQuestionRef.current,
      answers: answersRef.current,
      startTime: startTimeRef.current,
      wrongAnswers: answerCounts.wrong,
      correctAnswers: answerCounts.correct,
      selectedAnswers: selectedAnswersRef.current,
    }),
    onInitialSync: (d) => {
      startTimeRef.current = d.startTime;
      dispatch({
        type: "APPLY_LOADED_PROGRESS",
        payload: {
          answers: d.answers ?? [],
          question: null, // will be set by onQuestionUpdate
          finished: false,
        },
      });
    },
    onQuestionUpdate: (q, selected) => {
      dispatch({ type: "SET_CURRENT_QUESTION", payload: { question: q } });
      dispatch({ type: "SET_SELECTED_ANSWERS", payload: selected });
    },
    onAnswerChecked: (nextQuestion) => {
      checkAnswerRef.current(true, nextQuestion);
    },
  });

  // effects to keep refs updated
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    answersRef.current = answers;
    selectedAnswersRef.current = selectedAnswers;

    if (currentQuestionRef.current != null && !isHistoryQuestionRef.current) {
      setCurrentHistoryQuestion(currentQuestionRef.current);
    }
  }, [currentQuestion, answers, selectedAnswers, setCurrentHistoryQuestion]);

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

  async function loadProgress(sync: boolean): Promise<QuizSession | null> {
    return await appContext.services.quiz.getQuizProgress(quizId, sync);
  }

  const checkAnswer = useCallback(
    (
      remote = false,
      nextQuestionOverride?: Question | null,
      force?: boolean,
    ) => {
      /**
       * Sometimes we want to force checking answer - used in viewing history question
       */
      if (currentQuestionRef.current == null) {
        return;
      }
      if (force === false && questionChecked) {
        return;
      }

      const isCorrect = checkAnswerCorrectness(
        currentQuestionRef.current,
        selectedAnswers,
      );
      const newAnswer = createAnswerRecord(
        currentQuestionRef.current.id,
        selectedAnswers,
        isCorrect,
      );
      const updatedAnswers = [...runtime.answers, newAnswer];
      const nextQuestion_ =
        nextQuestionOverride ??
        pickNextQuestion(
          runtime.questions,
          updatedAnswers,
          runtime.settings,
          currentQuestionRef.current.id,
        );

      dispatch({
        type: "RECORD_ANSWER",
        payload: { answer: newAnswer, nextQuestion: nextQuestion_ },
      });

      if (!remote) {
        void appContext.services.quiz.recordAnswer(
          quizId,
          newAnswer,
          studyTime,
          nextQuestion_?.id ?? null,
        );
      }

      if (!remote) {
        continuity.sendAnswerChecked(nextQuestion_);
      }
    },
    [
      appContext.services.quiz,
      continuity,
      questionChecked,
      quizId,
      runtime.answers,
      runtime.questions,
      runtime.settings,
      selectedAnswers,
      studyTime,
    ],
  );

  /**
   * Open history question
   * Back to current question if args not provided
   */
  const openHistoryQuestion = useCallback(
    (historyQuestion?: HistoryEntry) => {
      // Back to normal quiz
      if (historyQuestion == null) {
        isHistoryQuestionRef.current = false;
        dispatch({
          type: "SET_IS_HISTORY_QUESTION",
          payload: false,
        });
        dispatch({
          type: "SET_CURRENT_QUESTION",
          payload: { question: history.currentQuestion },
        });
        return;
      }

      if (!canGoBack) {
        return;
      }

      isHistoryQuestionRef.current = true;
      dispatch({
        type: "SET_IS_HISTORY_QUESTION",
        payload: true,
      });
      dispatch({
        type: "SET_CURRENT_QUESTION",
        payload: { question: historyQuestion.question },
      });
      dispatch({
        type: "SET_SELECTED_ANSWERS",
        payload: historyQuestion.selectedAnswers,
      });
      checkAnswer(false, null, true);
    },
    [canGoBack, checkAnswer, history],
  );

  useEffect(() => {
    checkAnswerRef.current = checkAnswer;
  }, [checkAnswer]);

  const nextQuestion = useCallback(() => {
    if (quiz === null) {
      return;
    }

    if (currentQuestionRef.current != null) {
      addHistoryEntry(currentQuestionRef.current, selectedAnswersRef.current);
    }

    dispatch({ type: "ADVANCE_QUESTION" });
    if (runtime.nextQuestion !== null) {
      continuity.sendQuestionUpdate(runtime.nextQuestion, []);
    }
  }, [addHistoryEntry, continuity, quiz, runtime.nextQuestion]);

  const nextAction = useCallback(() => {
    if (questionChecked) {
      nextQuestion();
    } else {
      checkAnswer();
    }
  }, [checkAnswer, nextQuestion, questionChecked]);

  const skipQuestion = useCallback(() => {
    if (questionChecked) {
      nextQuestion();
      return;
    }

    if (currentQuestionRef.current == null) {
      return;
    }

    const newAnswer = createAnswerRecord(
      currentQuestionRef.current.id,
      [],
      false,
    );
    const updatedAnswers = [...runtime.answers, newAnswer];
    const nextQuestion_ = pickNextQuestion(
      runtime.questions,
      updatedAnswers,
      runtime.settings,
      currentQuestionRef.current.id,
    );

    dispatch({
      type: "RECORD_ANSWER",
      payload: { answer: newAnswer, nextQuestion: nextQuestion_ },
    });

    void appContext.services.quiz.recordAnswer(
      quizId,
      newAnswer,
      studyTime,
      nextQuestion_?.id ?? null,
    );

    addHistoryEntry(currentQuestionRef.current, []);

    continuity.sendAnswerChecked(nextQuestion_);
    if (nextQuestion_ !== null) {
      continuity.sendQuestionUpdate(nextQuestion_, []);
    }
    dispatch({ type: "ADVANCE_QUESTION" });
  }, [
    addHistoryEntry,
    appContext.services.quiz,
    continuity,
    nextQuestion,
    questionChecked,
    quizId,
    runtime.answers,
    runtime.questions,
    runtime.settings,
    studyTime,
  ]);

  const resetProgress = useCallback(async () => {
    await appContext.services.quiz.deleteQuizProgress(
      quizId,
      userSettings.sync_progress,
    );
    if (quiz !== null) {
      dispatch({
        type: "RESET_PROGRESS",
      });
      clearHistory();
      setTimer(0, Date.now());
    }
  }, [
    appContext.services.quiz,
    quizId,
    userSettings.sync_progress,
    quiz,
    clearHistory,
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

        const progressSettings = {
          initialReoccurrences: nextSettings.initial_reoccurrences,
          wrongAnswerReoccurrences: nextSettings.wrong_answer_reoccurrences,
        };

        const saved = await loadProgress(nextSettings.sync_progress);

        if (saved === null) {
          dispatch({
            type: "INIT_SESSION",
            payload: {
              questions: _quiz.questions,
              settings: progressSettings,
            },
          });
        } else {
          dispatch({
            type: "INIT_SESSION",
            payload: {
              questions: _quiz.questions,
              settings: progressSettings,
              answers: saved.answers,
              currentQuestionId: saved.current_question,
            },
          });
          setTimer(saved.study_time, Date.now() - saved.study_time * 1000);
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
    history,
    state: {
      currentQuestion,
      selectedAnswers,
      questionChecked,
      isQuizFinished,
      showBrainrot,
      canGoBack,
      isHistoryQuestion,
      showHistory,
    },
    stats: {
      correctAnswersCount: answerCounts.correct,
      wrongAnswersCount: answerCounts.wrong,
      masteredCount: mastered,
      totalQuestions: questions.length,
      studyTime,
      answers,
    },
    continuity: {
      isHost: continuity.isHost,
      peerConnections: continuity.peerConnections,
    },
    actions: {
      nextAction,
      skipQuestion,
      resetProgress,
      setSelectedAnswers: (ans: string[]) => {
        selectedAnswersRef.current = ans;
        dispatch({ type: "SET_SELECTED_ANSWERS", payload: ans });
        if (currentQuestion !== null) {
          continuity.sendQuestionUpdate(currentQuestion, ans);
        }
      },
      toggleBrainrot: () => {
        dispatch({ type: "TOGGLE_BRAINROT" });
      },
      openHistoryQuestion,
      toggleHistory: () => {
        dispatch({ type: "TOGGLE_HISTORY" });
      },
    },
  } as const;
}
