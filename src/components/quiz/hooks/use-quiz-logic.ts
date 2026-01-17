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

  // refs for continuity
  const currentQuestionRef = useRef<Question | null>(null);
  const answersRef = useRef<AnswerRecord[]>([]);
  const selectedAnswersRef = useRef<string[]>([]);

  // refs for continuity
  const checkAnswerRef = useRef<(remote?: boolean) => void>(() => {
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
    onAnswerChecked: () => {
      checkAnswerRef.current(true);
    },
  });

  // effects to keep refs updated
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    answersRef.current = answers;
    selectedAnswersRef.current = selectedAnswers;
  }, [currentQuestion, answers, selectedAnswers]);

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
    (remote = false) => {
      if (questionChecked || currentQuestionRef.current == null) {
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

      if (!remote && !appContext.isGuest) {
        void appContext.services.quiz.recordAnswer(
          quizId,
          currentQuestionRef.current.id,
          selectedAnswers,
          studyTime,
          nextQuestion_?.id ?? null,
        );
      }

      if (!remote) {
        continuity.sendAnswerChecked();
      }
    },
    [
      appContext.isGuest,
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

  useEffect(() => {
    checkAnswerRef.current = checkAnswer;
  }, [checkAnswer]);

  const nextQuestion = useCallback(() => {
    if (quiz === null) {
      return;
    }
    dispatch({ type: "ADVANCE_QUESTION" });
    if (runtime.currentQuestion !== null) {
      continuity.sendQuestionUpdate(runtime.currentQuestion, []);
    }
  }, [continuity, quiz, runtime.currentQuestion]);

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

    if (!appContext.isGuest) {
      void appContext.services.quiz.recordAnswer(
        quizId,
        currentQuestionRef.current.id,
        [],
        studyTime,
        nextQuestion_?.id ?? null,
      );
    }

    continuity.sendAnswerChecked();
    nextQuestion();
  }, [
    appContext.isGuest,
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
      setTimer(0, Date.now());
    }
  }, [
    appContext.services.quiz,
    quiz,
    quizId,
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
    state: {
      currentQuestion,
      selectedAnswers,
      questionChecked,
      isQuizFinished,
      showBrainrot,
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
    },
  } as const;
}
