import formbricks from "@formbricks/js";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useContext, useState } from "react";

import { AppContext } from "@/app-context";
import {
  INITIAL_CLIENT_STATE,
  quizDetailQueryKey,
} from "@/components/quiz/helpers/utils";
import {
  deriveSettings,
  getAnswerCounts,
  getMasteredCount,
  isQuizComplete,
  pickNextQuestion,
  resolveCurrentQuestion,
} from "@/lib/session-utils";
import type {
  AnswerRecord,
  Question,
  QuizSession,
  QuizWithUserProgress,
} from "@/types/quiz";

import type { ClientState } from "./types";

export function useActiveQuiz(quizId: string) {
  const queryClient = useQueryClient();
  const appContext = useContext(AppContext);

  const { data: quiz } = useSuspenseQuery<QuizWithUserProgress>({
    queryKey: quizDetailQueryKey(quizId),
    queryFn: async () => {
      return await appContext.services.quiz.getQuizWithProgress(quizId);
    },
    retry: 1,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const userSettings = deriveSettings(quiz.user_settings);
  const answers = quiz.current_session?.answers ?? [];

  const currentQuestion = resolveCurrentQuestion(quiz, userSettings);
  const isQuizFinished =
    currentQuestion === null &&
    isQuizComplete(quiz.questions, answers, userSettings);
  const answerCounts = getAnswerCounts(answers);
  const mastered = getMasteredCount(quiz.questions, answers, userSettings);

  const [client, setClient] = useState<ClientState>(INITIAL_CLIENT_STATE);

  const updateServerCache = (
    updater: (quiz: QuizWithUserProgress) => QuizWithUserProgress,
  ) => {
    queryClient.setQueryData<QuizWithUserProgress>(
      quizDetailQueryKey(quizId),
      (old) => {
        if (old == null) {
          return old;
        }
        return updater(old);
      },
    );
  };

  const setSelectedAnswers = (selected: string[]) => {
    setClient((previous) => ({ ...previous, selectedAnswers: selected }));
  };

  const recordAnswer = (
    answer: AnswerRecord,
    nextQuestionOverride?: Question | null,
  ): { nextQuestion: Question | null } => {
    const updatedAnswers = [answer, ...answers];
    const next =
      nextQuestionOverride ??
      pickNextQuestion({
        questions: quiz.questions,
        answers: updatedAnswers,
        settings: userSettings,
        currentQuestionId: currentQuestion?.id,
      });

    updateServerCache((previous) => ({
      ...previous,
      current_session:
        previous.current_session == null
          ? previous.current_session
          : {
              ...previous.current_session,
              answers: [answer, ...previous.current_session.answers],
            },
    }));

    setClient((previous) => ({
      ...previous,
      questionChecked: true,
      nextQuestionId: next?.id ?? null,
    }));

    return { nextQuestion: next };
  };

  const advanceQuestion = () => {
    if (client.questionChecked) {
      updateServerCache((quizData) => ({
        ...quizData,
        current_session:
          quizData.current_session == null
            ? quizData.current_session
            : {
                ...quizData.current_session,
                current_question: client.nextQuestionId,
              },
      }));

      if (
        client.nextQuestionId === null &&
        isQuizComplete(quiz.questions, answers, userSettings)
      ) {
        void formbricks.track("quiz_finished");
      }
    }

    setClient(INITIAL_CLIENT_STATE);
  };

  const setCurrentQuestion = (question: Question | null) => {
    updateServerCache((previous) => ({
      ...previous,
      current_session:
        previous.current_session == null
          ? previous.current_session
          : {
              ...previous.current_session,
              current_question: question?.id ?? null,
            },
    }));
    setClient(INITIAL_CLIENT_STATE);
  };

  const applyLoadedProgress = (
    loadedAnswers: AnswerRecord[],
    question: Question | null,
  ) => {
    updateServerCache((previous) => ({
      ...previous,
      current_session:
        previous.current_session == null
          ? previous.current_session
          : {
              ...previous.current_session,
              answers: loadedAnswers,
              current_question: question?.id ?? null,
            },
    }));
    setClient(INITIAL_CLIENT_STATE);
  };

  const resetProgress = (session: QuizSession) => {
    updateServerCache((previous) => ({
      ...previous,
      current_session: session,
    }));

    setClient(INITIAL_CLIENT_STATE);
  };

  return {
    quiz,
    userSettings,
    currentQuestion,
    isQuizFinished,
    answers,
    answerCounts,
    mastered,
    client,
    actions: {
      setSelectedAnswers,
      setCurrentQuestion,
      recordAnswer,
      advanceQuestion,
      applyLoadedProgress,
      resetProgress,
    },
  };
}
