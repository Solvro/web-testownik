import { useEffect, useReducer, useRef } from "react";

import {
  checkAnswerCorrectness,
  getMasteredCount,
  pickNextQuestion,
} from "@/lib/session-utils";
import { getDeterministicShuffle } from "@/lib/shuffle-utils";
import type {
  AnswerRecord,
  Question,
  QuizWithUserProgress,
} from "@/types/quiz";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

import {
  createAnswerRecord,
  initialRuntime,
  runtimeReducer,
  selectAnswerCounts,
} from "./quiz-runtime-reducer";
import type { UseQuizLogicParameters, UseQuizLogicResult } from "./types";
import { useQuizContinuity } from "./use-quiz-continuity";
import { useQuizData } from "./use-quiz-data";
import { useStudyTimer } from "./use-study-timer";

export function useQuizLogic({
  quizId,
  appContext,
}: UseQuizLogicParameters): UseQuizLogicResult {
  const { data: initialData } = useQuizData(quizId);
  const quiz = initialData;
  const userSettings = initialData.user_settings ?? {
    ...DEFAULT_USER_SETTINGS,
  };
  const loading = false;

  const [runtime, dispatch] = useReducer(
    runtimeReducer,
    initialData,
    (data) => {
      const payload = getInitialSessionPayload(data);
      return runtimeReducer(initialRuntime, {
        type: "INIT_SESSION",
        payload,
      });
    },
  );

  useEffect(() => {
    const payload = getInitialSessionPayload(initialData);

    dispatch({
      type: "INIT_SESSION",
      payload,
    });
  }, [initialData]);

  const {
    currentQuestion,
    selectedAnswers,
    questionChecked,
    isQuizFinished,
    showHistory,
    showBrainrot,
    answers,
    questions,
    settings,
    canGoBack,
    isHistoryQuestion,
  } = runtime;

  const {
    store: timerStore,
    setFromLoaded: setTimer,
    getStartTime,
  } = useStudyTimer(
    isQuizFinished,
    initialData.current_session?.study_time ?? 0,
  );

  const getCurrentStudyTime = () => timerStore.getSnapshot();

  // refs for continuity
  const currentQuestionRef = useRef<Question | null>(null);
  const answersRef = useRef<AnswerRecord[]>([]);
  const selectedAnswersRef = useRef<string[]>([]);
  const historyQuestionRef = useRef<Question | null>(null);
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
      startTime: getStartTime(),
      wrongAnswers: answerCounts.wrong,
      correctAnswers: answerCounts.correct,
      selectedAnswers: selectedAnswersRef.current,
    }),
    onInitialSync: (d) => {
      timerStore.setStartTime(d.startTime);
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
    userId: appContext.user?.user_id,
  });

  // effects to keep refs updated
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    answersRef.current = answers;
    selectedAnswersRef.current = selectedAnswers;
  }, [currentQuestion, answers, selectedAnswers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkAnswer = (
    remote = false,
    nextQuestionOverride?: Question | null,
    force?: boolean,
  ) => {
    /**
     * Sometimes we want to force checking answer - used in viewing history question
     */
    if (
      currentQuestionRef.current == null ||
      (force === false && questionChecked)
    ) {
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
        getCurrentStudyTime(),
        nextQuestion_?.id ?? null,
      );
    }

    if (!remote) {
      continuity.sendAnswerChecked(nextQuestion_);
    }
  };

  useEffect(() => {
    checkAnswerRef.current = checkAnswer;
  }, [checkAnswer]);

  const nextQuestion = () => {
    dispatch({ type: "ADVANCE_QUESTION" });
    if (runtime.nextQuestion !== null) {
      continuity.sendQuestionUpdate(runtime.nextQuestion, []);
    }
  };

  const nextAction = () => {
    if (questionChecked) {
      nextQuestion();
    } else {
      checkAnswer();
    }
  };

  const skipQuestion = () => {
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
      getCurrentStudyTime(),
      nextQuestion_?.id ?? null,
    );

    continuity.sendAnswerChecked(nextQuestion_);
    if (nextQuestion_ !== null) {
      continuity.sendQuestionUpdate(nextQuestion_, []);
    }
    dispatch({ type: "ADVANCE_QUESTION" });
  };

  const goToPreviousQuestion = () => {
    if (isHistoryQuestion && historyQuestionRef.current != null) {
      dispatch({
        type: "SET_IS_HISTORY_QUESTION",
        payload: false,
      });
      dispatch({
        type: "SET_CURRENT_QUESTION",
        payload: { question: historyQuestionRef.current },
      });
      historyQuestionRef.current = null;
      return;
    }

    if (answersRef.current.length === 0 || !canGoBack) {
      return;
    }

    const lastAnswer = answersRef.current[0];
    const previousQuestion = quiz.questions.find(
      (q) => q.id === lastAnswer.question,
    );

    if (previousQuestion == null) {
      return;
    }

    historyQuestionRef.current = currentQuestionRef.current;
    dispatch({
      type: "SET_IS_HISTORY_QUESTION",
      payload: true,
    });
    dispatch({
      type: "SET_CURRENT_QUESTION",
      payload: { question: previousQuestion },
    });
    dispatch({
      type: "SET_SELECTED_ANSWERS",
      payload: lastAnswer.selected_answers,
    });
    checkAnswer(true, null, true);
  };

  const resetProgress = async () => {
    await appContext.services.quiz.deleteQuizProgress(
      quizId,
      userSettings.sync_progress,
    );
    dispatch({
      type: "RESET_PROGRESS",
    });
    setTimer(0, Date.now());
  };

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
      isHistoryQuestion,
      showHistory,
      showBrainrot,
    },
    stats: {
      correctAnswersCount: answerCounts.correct,
      wrongAnswersCount: answerCounts.wrong,
      masteredCount: mastered,
      totalQuestions: questions.length,
      timerStore,
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
      toggleHistory: () => {
        dispatch({ type: "TOGGLE_HISTORY" });
      },
      toggleBrainrot: () => {
        dispatch({ type: "TOGGLE_BRAINROT" });
      },
      goToPreviousQuestion,
    },
  } as const;
}

function getInitialSessionPayload(initialData: QuizWithUserProgress) {
  const progressSettings = {
    initialReoccurrences:
      initialData.user_settings?.initial_reoccurrences ??
      DEFAULT_USER_SETTINGS.initial_reoccurrences,
    wrongAnswerReoccurrences:
      initialData.user_settings?.wrong_answer_reoccurrences ??
      DEFAULT_USER_SETTINGS.wrong_answer_reoccurrences,
  };

  const session = initialData.current_session;
  let precomputedCurrentQuestion: Question | null = null;
  if (session?.current_question != null) {
    const savedQuestion = initialData.questions.find(
      (q) => q.id === session.current_question,
    );
    if (savedQuestion !== undefined) {
      const seed = `${session.id}-${String(session.study_time)}`;
      precomputedCurrentQuestion = {
        ...savedQuestion,
        answers: getDeterministicShuffle(savedQuestion.answers, seed),
      };
    }
  }

  return {
    questions: initialData.questions,
    settings: progressSettings,
    answers: session?.answers,
    currentQuestionId: session?.current_question,
    precomputedCurrentQuestion,
  };
}
