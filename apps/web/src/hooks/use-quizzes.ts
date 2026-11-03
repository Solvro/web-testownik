import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { QuizMetadata, SharedQuiz } from "@testownik/core/quiz/types";

import { getQuizService } from "@/services";

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

export function useLastUsedQuizzes({
  limit = 20,
  enabled = true,
}: { limit?: number; enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["last-used-quizzes", limit],
    queryFn: async ({ pageParam: offset }: { pageParam: number }) =>
      getQuizService().getLastUsedQuizzes(limit, offset),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.next == null ? undefined : allPages.length * limit,
    refetchOnWindowFocus: false,
    enabled,
  });
}
