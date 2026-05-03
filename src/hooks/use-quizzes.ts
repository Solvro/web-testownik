import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import type { QuizMetadata, SharedQuiz } from "@/types/quiz";

export function useUserQuizzes(
  props?: Omit<UseQueryOptions<QuizMetadata[]>, "queryKey" | "queryFn">,
) {
  const appContext = useContext(AppContext);

  return useQuery({
    queryKey: ["user-quizzes", appContext],
    queryFn: async () => {
      return appContext.services.quiz.getQuizzes();
    },
    refetchOnWindowFocus: false,
    retry: 1,
    ...props,
  });
}

export function useSharedQuizzes(
  props?: Omit<UseQueryOptions<SharedQuiz[]>, "queryKey" | "queryFn">,
) {
  const appContext = useContext(AppContext);

  return useQuery({
    queryKey: ["shared-quizzes", appContext],
    queryFn: async () => {
      return appContext.services.quiz.getSharedQuizzes();
    },
    refetchOnWindowFocus: false,
    retry: 1,
    ...props,
  });
}
