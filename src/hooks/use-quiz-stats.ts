import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getQuizService } from "@/services";
import type { QuizMetadata } from "@/types/quiz";
import type { StatsScope } from "@/types/quiz-stats";

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
    queryFn: async () => getQuizService().getQuizMetadata(quizId),
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
    queryFn: async () => getQuizService().getQuizStats(quizId, scope),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}

export function useQuizTimeline(quizId: string, scope: StatsScope, days = 30) {
  return useQuery({
    queryKey: quizStatsKeys.timeline(quizId, scope, days),
    queryFn: async () => getQuizService().getQuizTimeline(quizId, scope, days),
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
    queryFn: async () => getQuizService().getQuizSessions(quizId, scope, days),
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
      getQuizService().getQuizHardestQuestions(quizId, scope, limit),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useQuizHourly(quizId: string, scope: StatsScope) {
  return useQuery({
    queryKey: quizStatsKeys.hourly(quizId, scope),
    queryFn: async () => getQuizService().getQuizHourly(quizId, scope),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
