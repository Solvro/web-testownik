import { useEffect, useRef, useState } from "react";

import {
  checkAnswerCorrectness,
  createAnswerRecord,
} from "@/lib/session-utils";
import type { AnswerRecord, Question } from "@/types/quiz";

import type { UseQuizLogicParameters, UseQuizLogicResult } from "./types";
import { useActiveQuiz } from "./use-active-quiz";
import { useQuizContinuity } from "./use-quiz-continuity";
import { useStudyTimer } from "./use-study-timer";

export function useQuizLogic({
  quizId,
  appContext,
}: UseQuizLogicParameters): UseQuizLogicResult {
  const {
    quiz,
    userSettings,
    currentQuestion,
    isQuizFinished,
    answers,
    answerCounts,
    mastered,
    client,
    actions: sessionActions,
  } = useActiveQuiz(quizId);

  const { selectedAnswers, questionChecked } = client;

  const [showHistory, setShowHistory] = useState(false);
  const [showBrainrot, setShowBrainrot] = useState(false);
  const [historyQuestionId, setHistoryQuestionId] = useState<string | null>(
    null,
  );

  const {
    store: timerStore,
    setFromLoaded: setTimer,
    getStartTime,
  } = useStudyTimer(isQuizFinished, quiz.current_session?.study_time ?? 0);

  const getCurrentStudyTime = () => timerStore.getSnapshot();

  // refs for continuity
  const currentQuestionRef = useRef<Question | null>(currentQuestion);
  const answersRef = useRef<AnswerRecord[]>(answers);
  const selectedAnswersRef = useRef<string[]>(selectedAnswers);
  const nextQuestionRef = useRef<Question | null>(null);
  const checkAnswerRef = useRef<
    (remote?: boolean, nextQuestion?: Question | null) => void
  >(() => {
    /* noop until assigned */
  });

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
      sessionActions.applyLoadedProgress(
        d.answers ?? [],
        null, // will be set by onQuestionUpdate
      );
    },
    onQuestionUpdate: (q, selected) => {
      sessionActions.setCurrentQuestion(q);
      sessionActions.setSelectedAnswers(selected);
      setHistoryQuestionId(null);
    },
    onAnswerChecked: (nextQuestion) => {
      checkAnswerRef.current(true, nextQuestion);
      setHistoryQuestionId(null);
    },
    onResetProgress: (session) => {
      sessionActions.resetProgress(session);
      setTimer(0, Date.now());
      setHistoryQuestionId(null);
    },
    userId: appContext.user?.user_id,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkAnswer = (
    remote = false,
    nextQuestionOverride?: Question | null,
    force?: boolean,
  ) => {
    if (
      currentQuestionRef.current == null ||
      (force === false && questionChecked)
    ) {
      return;
    }

    const isCorrect = checkAnswerCorrectness(
      currentQuestionRef.current,
      selectedAnswersRef.current,
    );
    const newAnswer = createAnswerRecord(
      currentQuestionRef.current.id,
      selectedAnswersRef.current,
      isCorrect,
    );

    const { nextQuestion } = sessionActions.recordAnswer(
      newAnswer,
      nextQuestionOverride,
    );
    nextQuestionRef.current = nextQuestion;

    if (!remote) {
      void appContext.services.quiz.recordAnswer(
        quizId,
        newAnswer,
        getCurrentStudyTime(),
        nextQuestionRef.current?.id ?? client.nextQuestionId,
      );
    }

    if (!remote) {
      const nextQ = nextQuestionRef.current;
      continuity.sendAnswerChecked(nextQ);
    }
  };

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    answersRef.current = answers;
    selectedAnswersRef.current = selectedAnswers;
    checkAnswerRef.current = checkAnswer;
  }, [currentQuestion, answers, selectedAnswers, checkAnswer]);

  const advanceToNext = () => {
    const nextQ = nextQuestionRef.current;
    sessionActions.advanceQuestion();
    nextQuestionRef.current = null;
    continuity.sendQuestionUpdate(nextQ, []);
  };

  const nextAction = () => {
    if (questionChecked) {
      advanceToNext();
    } else {
      checkAnswer();
    }
  };

  const skipQuestion = () => {
    if (questionChecked) {
      advanceToNext();
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

    const { nextQuestion: nextQ } = sessionActions.recordAnswer(newAnswer);
    nextQuestionRef.current = nextQ;

    void appContext.services.quiz.recordAnswer(
      quizId,
      newAnswer,
      getCurrentStudyTime(),
      nextQ?.id ?? null,
    );

    continuity.sendAnswerChecked(nextQ);
    continuity.sendQuestionUpdate(nextQ, []);
    sessionActions.advanceQuestion();
    nextQuestionRef.current = null;
  };

  const togglePreviousQuestion = () => {
    if (historyQuestionId !== null) {
      setHistoryQuestionId(null);
      if (currentQuestion !== null) {
        continuity.sendQuestionUpdate(currentQuestion, selectedAnswers);
      }
      return;
    }

    if (answersRef.current.length === 0) {
      return;
    }

    const lastAnswer = answersRef.current[0];
    const previousQuestion = quiz.questions.find(
      (q) => q.id === lastAnswer.question,
    );

    if (previousQuestion == null) {
      return;
    }

    setHistoryQuestionId(previousQuestion.id);
  };

  const resetProgress = async () => {
    const session = await appContext.services.quiz.deleteQuizProgress(
      quizId,
      userSettings.sync_progress,
      quiz,
    );
    sessionActions.resetProgress(session);
    setTimer(0, Date.now());
    setHistoryQuestionId(null);
    continuity.sendResetProgress(session);
  };

  const historyQuestion =
    historyQuestionId == null
      ? null
      : (quiz.questions.find((q) => q.id === historyQuestionId) ?? null);

  return {
    quiz,
    userSettings,
    state: {
      currentQuestion: historyQuestion ?? currentQuestion,
      selectedAnswers:
        historyQuestion == null
          ? selectedAnswers
          : (answers.find((a) => a.question === historyQuestionId)
              ?.selected_answers ?? []),
      questionChecked: historyQuestion == null ? questionChecked : true,
      isQuizFinished,
      canGoBack: answers.length > 0,
      isHistoryQuestion: historyQuestion != null,
      showHistory,
      showBrainrot,
    },
    stats: {
      correctAnswersCount: answerCounts.correct,
      wrongAnswersCount: answerCounts.wrong,
      masteredCount: mastered,
      totalQuestions: quiz.questions.length,
      timerStore,
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
        sessionActions.setSelectedAnswers(ans);
        if (currentQuestion !== null) {
          continuity.sendQuestionUpdate(currentQuestion, ans);
        }
      },
      toggleHistory: () => {
        setShowHistory((h) => !h);
      },
      toggleBrainrot: () => {
        setShowBrainrot((b) => !b);
      },
      togglePreviousQuestion,
    },
  } as const;
}
