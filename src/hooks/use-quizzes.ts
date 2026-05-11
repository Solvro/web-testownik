import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

import { getQuizService } from "@/services";
import type { QuizMetadata, SharedQuiz } from "@/types/quiz";

export function useUserQuizzes(
  props?: Omit<UseQueryOptions<QuizMetadata[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["user-quizzes"],
    queryFn: async () => getQuizService().getQuizzes(),
    refetchOnWindowFocus: false,
    retry: 1,
    ...props,
  });
}

export function useSharedQuizzes(
  props?: Omit<UseQueryOptions<SharedQuiz[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["shared-quizzes"],
    queryFn: async () => getQuizService().getSharedQuizzes(),
    refetchOnWindowFocus: false,
    retry: 1,
    ...props,
  });
}
