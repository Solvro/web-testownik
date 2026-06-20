import type { ClientState } from "@/components/quiz/hooks/types";
import type { QuizWithUserProgress } from "@/types/quiz";

export const INITIAL_CLIENT_STATE: ClientState = {
  selectedAnswers: [],
  questionChecked: false,
  nextQuestionId: null,
};

export function quizQueryKey(quizId: string) {
  return ["quiz", quizId] as const;
}

export function quizDetailQueryKey(quizId: string) {
  return [
    "quiz",
    quizId,
    "details",
    { include: ["user_settings", "current_session"] },
  ] as const;
}

export function isCurrentSessionQuestion(
  quiz: QuizWithUserProgress,
  questionId: string,
) {
  return quiz.current_session?.current_question === questionId;
}

export function removeQuestionFromQuizCache({
  quiz,
  deletedQuestionId,
  newCurrentQuestionId,
}: {
  quiz: QuizWithUserProgress;
  deletedQuestionId: string;
  newCurrentQuestionId: string | null;
}): QuizWithUserProgress {
  const deletedCurrentQuestion = isCurrentSessionQuestion(
    quiz,
    deletedQuestionId,
  );

  return {
    ...quiz,
    questions: quiz.questions.filter((q) => q.id !== deletedQuestionId),
    current_session:
      quiz.current_session == null
        ? null
        : {
            ...quiz.current_session,
            answers: quiz.current_session.answers.filter(
              (answer) => answer.question !== deletedQuestionId,
            ),
            ...(deletedCurrentQuestion
              ? { current_question: newCurrentQuestionId }
              : {}),
          },
  };
}
