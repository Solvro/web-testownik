import type { ClientState } from "@/components/quiz/hooks/types";
import type { Question, Quiz, QuizWithUserProgress } from "@/types/quiz";

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

export function replaceQuestionInQuiz<TQuiz extends Quiz>(
  quiz: TQuiz,
  updatedQuestion: Question,
): TQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map((q) =>
      q.id === updatedQuestion.id ? updatedQuestion : q,
    ),
  };
}

export function removeQuestionFromQuiz<TQuiz extends Quiz>(
  quiz: TQuiz,
  deletedQuestionId: string,
): TQuiz {
  return {
    ...quiz,
    questions: quiz.questions.filter((q) => q.id !== deletedQuestionId),
  };
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
  const quizWithoutQuestion = removeQuestionFromQuiz(quiz, deletedQuestionId);

  return {
    ...quizWithoutQuestion,
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
