import { QueryClient } from "@tanstack/react-query";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { toast } from "sonner";

import { quizStatsKeys } from "@/hooks/use-quiz-stats";
import { userSettingsQueryKey } from "@/hooks/use-user-settings";
import { bindServices } from "@/services/client-services";

import {
  PREVIEW_HOURLY,
  PREVIEW_QUIZ_ID,
  PREVIEW_SESSIONS,
  PREVIEW_TIMELINE,
} from "./preview-fixtures";
import { createPreviewServices } from "./preview-services";

/**
 * Which screen's toaster a cache's services report to. Several screens can
 * share one cache (the laptop and the iPhone), so it is whichever the visitor
 * touched last — the one the action came from.
 */
const activeToaster = new WeakMap<QueryClient, string>();

export function setActivePreviewToaster(
  client: QueryClient,
  toasterId: string,
  { onlyIfUnset = false }: { onlyIfUnset?: boolean } = {},
): void {
  if (!onlyIfUnset || !activeToaster.has(client)) {
    activeToaster.set(client, toasterId);
  }
}

/**
 * A throwaway query cache for a preview, bound to the preview services (see
 * `bindServices`), so anything rendered from it never reaches the API, the
 * session or the clipboard. Nothing in it goes stale; components render what
 * is there and the services answer the rest from fixtures.
 */
export function createPreviewClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
      mutations: { retry: false },
    },
  });
  bindServices(
    client,
    createPreviewServices((message) => {
      const toasterId = activeToaster.get(client);
      if (toasterId !== undefined) {
        toast(message, { toasterId });
      }
    }),
  );
  // The quiz settings dialog edits these; they never leave the cache.
  client.setQueryData(userSettingsQueryKey, DEFAULT_USER_SETTINGS);
  return client;
}

/**
 * The iPad cannot switch scope or range, so only the visible queries are
 * seeded, with a few representative points.
 */
export function createTabletClient(): QueryClient {
  const client = createPreviewClient();
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
