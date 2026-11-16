import type { UserSettings } from "@testownik/core/user/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "./api";
import { useSession } from "./session";
import { storage } from "./storage";

/** A quiz override leaves the account's Study Settings unchanged. */
export function useQuizAiModel(quizId?: string) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [client] = useState(() => api.forSession());
  const key = ["quiz-ai-model", user?.id, quizId] as const;
  const storageKey = `quiz-ai-model.${user?.id}.${quizId}`;
  const query = useQuery({
    queryKey: key,
    enabled: !!user && !!quizId,
    networkMode: "always",
    queryFn: () => storage.read<string | null>(storageKey, null),
  });
  // Share Study Settings' cache so changing the account default also updates
  // assistants that have no quiz override. The AI API's own default is global.
  const account = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    // An offline attempt should reach a retryable error rather than leave an
    // open hint waiting indefinitely on TanStack's paused network state.
    networkMode: "always",
    queryFn: ({ signal }) =>
      client.request<UserSettings>("settings/", { signal }),
  });
  const model =
    typeof query.data === "string" && query.data ? query.data : null;
  const accountModel = account.data?.default_ai_model || null;
  return {
    ...query,
    /** The stored quiz override; null follows Study Settings. */
    model,
    overridePending: !!quizId && query.isPending,
    overrideError: query.error,
    accountModel,
    accountLoaded: account.data !== undefined,
    effectiveModel: model ?? accountModel,
    isPending: (!!quizId && query.isPending) || (!model && account.isPending),
    error: query.error ?? (!model && !account.data ? account.error : null),
    refetch: () =>
      Promise.all([...(quizId ? [query.refetch()] : []), account.refetch()]),
    select: async (value: string | null) => {
      if (!user || !quizId) return;
      await storage.write(storageKey, value);
      qc.setQueryData(key, value);
    },
  };
}
