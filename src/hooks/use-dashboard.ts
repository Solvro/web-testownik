import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { GITHUB_REPOS, parseContributors } from "@/lib/contributors";
import type { GitHubContributor } from "@/lib/contributors";

export function useLastUsedQuizzes(isGuest: boolean, limit = 10) {
  const appContext = useContext(AppContext);

  return useInfiniteQuery({
    queryKey: ["last-used-quizzes", isGuest, limit],
    queryFn: async ({ pageParam: pageParameter }: { pageParam: number }) => {
      return appContext.services.quiz.getLastUsedQuizzes(limit, pageParameter);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.next === null) {
        return;
      }
      return allPages.length * limit;
    },
    // Don't refetch on window focus for dashboard data to avoid jumping content
    refetchOnWindowFocus: false,
  });
}

export function useRandomQuestion(isGuest: boolean) {
  const appContext = useContext(AppContext);

  return useQuery({
    queryKey: ["random-question", isGuest],
    queryFn: async () => {
      return appContext.services.quiz.getRandomQuestion();
    },
    refetchOnWindowFocus: false,
    retry: isGuest ? 0 : 1,
  });
}

/**
 * Fetch contributors from GitHub repos.
 * This is primarily for SSR fallback - if SSR prefetch fails or returns empty,
 * the client will attempt to fetch.
 */
async function fetchContributors(): Promise<GitHubContributor[]> {
  const responses = await Promise.all(
    GITHUB_REPOS.map(async (repo) =>
      fetch(`https://api.github.com/repos/${repo}/contributors?anon=1`),
    ),
  );

  if (responses.some((response) => !response.ok)) {
    throw new Error("Failed to fetch contributors");
  }

  const data = await Promise.all(
    responses.map(
      async (response) => response.json() as Promise<GitHubContributor[]>,
    ),
  );

  return parseContributors(data);
}

/**
 * Hook for contributors - uses SSR data if available, fetches on client only if needed.
 * SSR prefetches this data, so client fetch is only a fallback.
 */
export function useContributors() {
  return useQuery({
    queryKey: ["contributors"],
    queryFn: fetchContributors,
    staleTime: 1000 * 60 * 60, // 1 hour
    // Only refetch if SSR data failed or was empty
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
