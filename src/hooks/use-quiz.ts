import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

import { quizQueryKey } from "@/components/quiz/helpers/utils";
import { getQuizService } from "@/services";
import type { Quiz } from "@/types/quiz";

export function useQuiz(
  quizId: string,
  props?: Omit<UseQueryOptions<Quiz>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: quizQueryKey(quizId),
    queryFn: async () => getQuizService().getQuiz(quizId),
    enabled: quizId.trim() !== "",
    refetchOnWindowFocus: false,
    retry: 1,
    ...props,
  });
}
