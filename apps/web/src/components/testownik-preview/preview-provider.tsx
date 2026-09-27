"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import type { ReactNode } from "react";

import { quizStatsKeys } from "@/hooks/use-quiz-stats";

import {
  PREVIEW_HOURLY,
  PREVIEW_QUIZ_ID,
  PREVIEW_SESSIONS,
  PREVIEW_TIMELINE,
} from "./preview-fixtures";

/**
 * Seeds a throwaway query cache with a small sample of the landing fixtures.
 *
 * The stats components on the marketing page are the same ones the app renders;
 * they fetch through react-query. Pre-filling the cache lets them mount and
 * render their real markup without a request, an API base URL or a session —
 * so the landing page shows the product rather than a drawing of it. The iPad
 * cannot switch scope, so only the visible queries and a few representative
 * points are retained.
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
  client.setQueryData(
    quizStatsKeys.timeline(id, "me", 30),
    PREVIEW_TIMELINE.slice(-7),
  );
  client.setQueryData(
    quizStatsKeys.sessions(id, "me", 30),
    PREVIEW_SESSIONS.slice(-4),
  );
  client.setQueryData(
    quizStatsKeys.hourly(id, "me"),
    PREVIEW_HOURLY.filter(({ hour }) => hour % 3 === 0),
  );

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
