import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import type { GitHubContributor } from "@/lib/dashboard-ssr";

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
  const [coreResponse, frontendResponse] = await Promise.all([
    fetch(
      "https://api.github.com/repos/Solvro/backend-testownik/contributors?anon=1",
    ),
    fetch(
      "https://api.github.com/repos/Solvro/web-testownik/contributors?anon=1",
    ),
  ]);

  if (!coreResponse.ok || !frontendResponse.ok) {
    throw new Error("Failed to fetch contributors");
  }

  const coreData = (await coreResponse.json()) as GitHubContributor[];
  const frontendData = (await frontendResponse.json()) as GitHubContributor[];

  const merged = [...coreData, ...frontendData]
    .filter((contributor) => contributor.type === "User")
    .reduce((accumulator: GitHubContributor[], contributor) => {
      const existing = accumulator.find((x) => x.login === contributor.login);
      if (existing === undefined) {
        accumulator.push({ ...contributor });
      } else {
        existing.contributions += contributor.contributions;
      }
      return accumulator;
    }, []);

  return merged.toSorted((a, b) => b.contributions - a.contributions);
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
