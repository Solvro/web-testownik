"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import type { ReactNode } from "react";

import { quizStatsKeys } from "@/hooks/use-quiz-stats";

import {
  PREVIEW_HARDEST,
  PREVIEW_HOURLY,
  PREVIEW_QUIZ_ID,
  PREVIEW_QUIZ_METADATA,
  PREVIEW_SESSIONS,
  PREVIEW_STATS,
  PREVIEW_TIMELINE,
} from "./preview-fixtures";

/**
 * Seeds a throwaway query cache with the landing fixtures.
 *
 * The stats components on the marketing page are the same ones the app renders;
 * they fetch through react-query. Pre-filling the cache lets them mount and
 * render their real markup without a request, an API base URL or a session —
 * so the landing page shows the product rather than a drawing of it.
 */
function createPreviewClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Never considered stale, so nothing ever tries to refetch.
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
    },
  });

  const id = PREVIEW_QUIZ_ID;
  client.setQueryData(quizStatsKeys.metadata(id), PREVIEW_QUIZ_METADATA);
  for (const scope of ["me", "all"] as const) {
    client.setQueryData(
      quizStatsKeys.aggregated(id, scope),
      PREVIEW_STATS[scope],
    );
    client.setQueryData(
      quizStatsKeys.timeline(id, scope, 30),
      PREVIEW_TIMELINE,
    );
    client.setQueryData(quizStatsKeys.hourly(id, scope), PREVIEW_HOURLY);
    client.setQueryData(quizStatsKeys.hardest(id, scope, 10), PREVIEW_HARDEST);
  }
  client.setQueryData(quizStatsKeys.sessions(id, "me", 30), PREVIEW_SESSIONS);

  return client;
}

export function PreviewDataProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  // The cache is built once per mount and never refetches, so a ref is a truer
  // fit than state: nothing here ever triggers a re-render.
  const clientReference = useRef<QueryClient | null>(null);
  clientReference.current ??= createPreviewClient();
  return (
    <QueryClientProvider client={clientReference.current}>
      {children}
    </QueryClientProvider>
  );
}
