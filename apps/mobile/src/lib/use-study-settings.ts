import type { UserSettings } from "@testownik/core/user/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";

import { notify } from "./alerts";
import { api } from "./api";
import { useLocale } from "./locale";
import { useSession } from "./session";
import { settingsSaver } from "./settings-saver";
import { tokenStore } from "./storage";
import { userError } from "./user-error";

/** Settings and directly opened account pickers share one save owner per login. */
export function useStudySettings() {
  const cache = useQueryClient();
  const { t } = useLocale();
  const { user } = useSession();
  const [client] = useState(() => api.forSession());
  const query = useQuery({
    queryKey: ["settings", user?.id],
    networkMode: "always",
    queryFn: ({ signal }) =>
      client.request<UserSettings>("settings/", { signal }),
  });
  const ports = useMemo(() => {
    const queryKey = ["settings", user?.id];
    return {
      cancel: () => cache.cancelQueries({ queryKey }),
      save: (settings: UserSettings) =>
        client.patch<UserSettings>("settings/", settings),
      // Synchronous, so logout cannot happen between the session check and write.
      commit: (settings: UserSettings) => {
        cache.setQueryData(queryKey, settings);
      },
      report: (error: unknown) =>
        notify(
          t("Nie zapisano zmian", "Changes Not Saved"),
          userError(error, t),
        ),
    };
  }, [cache, client, t, user?.id]);
  const [saver] = useState(() => settingsSaver(tokenStore.session(), ports));
  useEffect(() => saver.configure(ports), [saver, ports]);
  const saved = useSyncExternalStore(
    saver.subscribe,
    saver.getSnapshot,
    saver.getSnapshot,
  );
  // Leave freely; the session owns the pending snapshot and retry state.
  useEffect(
    () => () => {
      void saver.flush();
    },
    [saver],
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void saver.flush();
    });
    return () => subscription.remove();
  }, [saver]);
  const value = saved.draft ?? query.data;
  const update = useCallback(
    (patch: Partial<UserSettings>) => {
      saver.update(query.data, patch);
    },
    [query.data, saver],
  );
  return { query, value, saved, saver, update };
}
