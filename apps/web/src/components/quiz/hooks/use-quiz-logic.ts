import {
  checkAnswerCorrectness,
  createAnswerRecord,
  createSelfAssessmentRecord,
  getAnsweredQuestionWithShuffledAnswers,
} from "@testownik/core/quiz/session";
import type { AnswerRecord, Question } from "@testownik/core/quiz/types";
import { useContext, useEffect, useRef, useState } from "react";

import { AppContext } from "@/app-context";
import { PermissionAction } from "@/lib/auth/permissions";
import { getQuizService } from "@/services";

import type { UseQuizLogicParameters, UseQuizLogicResult } from "./types";
import { useActiveQuiz } from "./use-active-quiz";
import { useQuizContinuity } from "./use-quiz-continuity";
import { useStudyTimer } from "./use-study-timer";

export function useQuizLogic({
  quizId,
}: UseQuizLogicParameters): UseQuizLogicResult {
  const { checkPermission, user } = useContext(AppContext);

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
  const applyRemoteRecordRef = useRef<
    (record: AnswerRecord, nextQuestion: Question | null) => void
  >(() => {
    /* noop until assigned */
  });

  // continuity hook
  const continuity = useQuizContinuity({
    enabled: checkPermission(PermissionAction.QUIZ_CONTINUITY),
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
    onAnswerChecked: (nextQuestion, record) => {
      // Peers send the record they made; older ones only say a check
      // happened, which is then repeated on this tab's own selection.
      if (record === undefined) {
        checkAnswerRef.current(true, nextQuestion);
      } else {
        applyRemoteRecordRef.current(record, nextQuestion);
      }
      setHistoryQuestionId(null);
    },
    onResetProgress: (session) => {
      sessionActions.resetProgress(session);
      setTimer(0, Date.now());
      setHistoryQuestionId(null);
    },
    userId: user?.user_id,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkAnswer = (
    remote = false,
    nextQuestionOverride?: Question | null,
    force?: boolean,
  ) => {
    // A checked question is not checked again, also when a peer reports the
    // check this tab already made.
    if (
      currentQuestionRef.current == null ||
      (force !== true && questionChecked)
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

    const studyTime = getCurrentStudyTime();
    const { nextQuestion } = sessionActions.recordAnswer(
      newAnswer,
      studyTime,
      nextQuestionOverride,
    );
    nextQuestionRef.current = nextQuestion;

    if (!remote) {
      void getQuizService().recordAnswer(
        quizId,
        newAnswer,
        studyTime,
        nextQuestionRef.current?.id ?? client.nextQuestionId,
      );
      continuity.sendAnswerChecked(nextQuestionRef.current, newAnswer);
    }
  };

  // A record a peer made: stored once, whatever the selection here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const applyRemoteRecord = (
    record: AnswerRecord,
    nextQuestion: Question | null,
  ) => {
    if (answersRef.current.some((answer) => answer.id === record.id)) {
      return;
    }
    const { nextQuestion: nextQ } = sessionActions.recordAnswer(
      record,
      getCurrentStudyTime(),
      nextQuestion,
    );
    nextQuestionRef.current = nextQ;
  };

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    answersRef.current = answers;
    selectedAnswersRef.current = selectedAnswers;
    checkAnswerRef.current = checkAnswer;
    applyRemoteRecordRef.current = applyRemoteRecord;
  }, [
    currentQuestion,
    answers,
    selectedAnswers,
    checkAnswer,
    applyRemoteRecord,
  ]);

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

    const studyTime = getCurrentStudyTime();
    const { nextQuestion: nextQ } = sessionActions.recordAnswer(
      newAnswer,
      studyTime,
    );
    nextQuestionRef.current = nextQ;

    void getQuizService().recordAnswer(
      quizId,
      newAnswer,
      studyTime,
      nextQ?.id ?? null,
    );

    continuity.sendAnswerChecked(nextQ, newAnswer);
    continuity.sendQuestionUpdate(nextQ, []);
    sessionActions.advanceQuestion(nextQ?.id ?? null);
    nextQuestionRef.current = null;
  };

  // A flashcard has no answer to check: the learner's own grade is recorded
  // and the next card follows at once. A grade for a card which is no
  // longer current, such as one finishing its swipe after a peer moved on,
  // is dropped.
  const gradeSelf = (knew: boolean, questionId?: string) => {
    if (
      currentQuestionRef.current == null ||
      questionChecked ||
      (questionId !== undefined && currentQuestionRef.current.id !== questionId)
    ) {
      return;
    }

    const record = createSelfAssessmentRecord(
      currentQuestionRef.current.id,
      knew,
    );
    const studyTime = getCurrentStudyTime();
    const { nextQuestion: nextQ } = sessionActions.recordAnswer(
      record,
      studyTime,
    );
    nextQuestionRef.current = nextQ;

    void getQuizService().recordAnswer(
      quizId,
      record,
      studyTime,
      nextQ?.id ?? null,
      knew,
    );

    continuity.sendAnswerChecked(nextQ, record);
    continuity.sendQuestionUpdate(nextQ, []);
    sessionActions.advanceQuestion(nextQ?.id ?? null);
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
    const session = await getQuizService().deleteQuizProgress(quizId, quiz);
    sessionActions.resetProgress(session);
    setTimer(0, Date.now());
    setHistoryQuestionId(null);
    continuity.sendResetProgress(session);
  };

  const handleQuestionDeleted = (
    deletedQuestionId: string,
    newCurrentQuestionId: string | null,
  ) => {
    if (historyQuestionId === deletedQuestionId) {
      setHistoryQuestionId(null);
    }

    if (currentQuestionRef.current?.id !== deletedQuestionId) {
      return;
    }

    const nextQuestion =
      sessionActions.replaceCurrentQuestionAfterDeletion(newCurrentQuestionId);
    nextQuestionRef.current = null;
    continuity.sendQuestionUpdate(nextQuestion, []);
  };

  const historyQuestion =
    historyQuestionId == null
      ? null
      : (() => {
          const question =
            quiz.questions.find((q) => q.id === historyQuestionId) ?? null;
          if (question == null) {
            return null;
          }

          const session = quiz.current_session;
          return getAnsweredQuestionWithShuffledAnswers(
            question,
            answers,
            session?.id,
          );
        })();

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
      wasCorrect:
        historyQuestion == null
          ? null
          : (answers.find((a) => a.question === historyQuestionId)
              ?.was_correct ?? null),
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
      isDisconnected: continuity.isDisconnected,
      isHost: continuity.isHost,
      peerConnections: continuity.peerConnections,
      disconnect: continuity.disconnect,
      reconnect: continuity.reconnect,
    },
    actions: {
      nextAction,
      skipQuestion,
      gradeSelf,
      resetProgress,
      setSelectedAnswers: (ans: string[]) => {
        selectedAnswersRef.current = ans;
        sessionActions.setSelectedAnswers(ans);
        if (currentQuestion !== null) {
          continuity.sendQuestionUpdate(currentQuestion, ans);
        }
      },
      onQuestionDeleted: handleQuestionDeleted,
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
