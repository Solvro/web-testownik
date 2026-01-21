import { useSuspenseQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import type { QuizWithUserProgress } from "@/types/quiz";

export function useQuizData(quizId: string) {
  const appContext = useContext(AppContext);

  return useSuspenseQuery<QuizWithUserProgress>({
    queryKey: [
      "quiz",
      quizId,
      "details",
      { include: ["user_settings", "current_session"] },
    ],
    queryFn: async () => {
      return await appContext.services.quiz.getQuiz(quizId, {
        include: ["user_settings", "current_session"],
      });
    },
  });
}
