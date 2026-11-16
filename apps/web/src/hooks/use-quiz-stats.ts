import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { StatsScope } from "@testownik/core/quiz/stats";
import type { QuizMetadata } from "@testownik/core/quiz/types";

import { notifyMobileSessionExpired } from "@/lib/auth/mobile-embed";
import { getQuizService } from "@/services";

// Embedded (mobile WebView) sessions keep their token in an HttpOnly cookie, so
// stats are proxied through /auth/mobile/stats. The root layout marks the body.
function isMobileEmbed(): boolean {
  return (
    typeof document !== "undefined" &&
    document.body.dataset.mobileEmbed === "true"
  );
}

async function requestStats<T>(
  id: string,
  part: string,
  parameters: Record<string, string | number>,
  fallback: () => Promise<T>,
): Promise<T> {
  if (!isMobileEmbed()) {
    return fallback();
  }
  const query = new URLSearchParams({
    id,
    part,
    ...Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => [key, String(value)]),
    ),
  });
  const response = await fetch(`/auth/mobile/stats?${query.toString()}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    notifyMobileSessionExpired(response.status);
    throw new Error("Nie udało się wczytać statystyk. Spróbuj ponownie.");
  }
  return (await response.json()) as T;
}

export const quizStatsKeys = {
  all: (quizId: string) => ["quiz-stats", quizId] as const,
  metadata: (quizId: string) => ["quiz-stats", quizId, "metadata"] as const,
  aggregated: (quizId: string, scope: StatsScope) =>
    ["quiz-stats", quizId, "aggregated", scope] as const,
  timeline: (quizId: string, scope: StatsScope, days: number) =>
    ["quiz-stats", quizId, "timeline", scope, days] as const,
  sessions: (quizId: string, scope: StatsScope, days: number) =>
    ["quiz-stats", quizId, "sessions", scope, days] as const,
  hardest: (quizId: string, scope: StatsScope, limit: number) =>
    ["quiz-stats", quizId, "hardest", scope, limit] as const,
  hourly: (quizId: string, scope: StatsScope) =>
    ["quiz-stats", quizId, "hourly", scope] as const,
};

export function useQuizMetadata(quizId: string) {
  return useQuery<QuizMetadata>({
    queryKey: quizStatsKeys.metadata(quizId),
    queryFn: async () =>
      requestStats(quizId, "metadata", {}, async () =>
        getQuizService().getQuizMetadata(quizId),
      ),
    enabled: quizId.trim() !== "",
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useQuizStats(
  quizId: string,
  scope: StatsScope,
  enabled = true,
) {
  return useQuery({
    queryKey: quizStatsKeys.aggregated(quizId, scope),
    queryFn: async () =>
      requestStats(quizId, "summary", { scope }, async () =>
        getQuizService().getQuizStats(quizId, scope),
      ),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}

export function useQuizTimeline(quizId: string, scope: StatsScope, days = 30) {
  return useQuery({
    queryKey: quizStatsKeys.timeline(quizId, scope, days),
    queryFn: async () =>
      requestStats(quizId, "timeline", { scope, days }, async () =>
        getQuizService().getQuizTimeline(quizId, scope, days),
      ),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useQuizSessions(
  quizId: string,
  scope: "me",
  days = 30,
  enabled = true,
) {
  return useQuery({
    queryKey: quizStatsKeys.sessions(quizId, scope, days),
    queryFn: async () =>
      requestStats(quizId, "sessions", { scope, days }, async () =>
        getQuizService().getQuizSessions(quizId, scope, days),
      ),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}

export function useQuizHardestQuestions(
  quizId: string,
  scope: StatsScope,
  limit = 10,
) {
  return useQuery({
    queryKey: quizStatsKeys.hardest(quizId, scope, limit),
    queryFn: async () =>
      requestStats(quizId, "hardest", { scope, limit }, async () =>
        getQuizService().getQuizHardestQuestions(quizId, scope, limit),
      ),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useQuizHourly(quizId: string, scope: StatsScope) {
  return useQuery({
    queryKey: quizStatsKeys.hourly(quizId, scope),
    queryFn: async () =>
      requestStats(quizId, "hourly", { scope }, async () =>
        getQuizService().getQuizHourly(quizId, scope),
      ),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
