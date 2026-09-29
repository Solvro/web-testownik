import type { UserSettings } from "@testownik/core/user/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";

import StudySettings from "../src/components/settings/StudySettings";
import { ErrorScreen, Loading } from "../src/components/ui";
import { notify } from "../src/lib/alerts";
import { api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";
import { onApplySettings } from "../src/lib/settings-bus";
import { useSession } from "../src/lib/session";
import { userError } from "../src/lib/user-error";

// Settings apply as you change them, like iOS Settings: edits are saved after a
// short pause, and anything still pending is sent when the screen closes.
const SAVE_DELAY = 600;

export default function Settings() {
  const cache = useQueryClient();
  const { t } = useLocale();
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["settings", user?.id],
    queryFn: () => api.request<UserSettings>("settings/"),
  });
  const guest = user?.account_type === "guest";
  const models = useQuery({
    queryKey: ["ai-models", user?.id],
    queryFn: () =>
      api.request<{
        models: { model: string; label: string; provider?: string }[];
        default_model: string | null;
      }>("ai/models/"),
    enabled: !guest && user?.account_level !== "basic",
  });
  const [edited, setEdited] = useState<UserSettings | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<UserSettings | null>(null);
  const inFlight = useRef(false);
  const queued = useRef<UserSettings | null>(null);
  const closed = useRef(false);

  // One request at a time, so the server always applies edits in order; the
  // newest edit waits behind a save that is still in flight.
  const save = async (settings: UserSettings): Promise<void> => {
    if (inFlight.current) {
      queued.current = settings;
      return;
    }
    inFlight.current = true;
    try {
      const result = await api.patch<UserSettings>("settings/", settings);
      if (!queued.current) cache.setQueryData(["settings", user?.id], result);
      if (pending.current === settings) pending.current = null;
      setEdited((current) => (current === settings ? null : current));
    } catch (error) {
      // After the screen closes, an alert is the only place left to report it.
      if (closed.current)
        notify(
          t("Nie zapisano zmian", "Changes Not Saved"),
          userError(error, t),
        );
      else setSaveError(error);
    } finally {
      inFlight.current = false;
      const next = queued.current;
      queued.current = null;
      if (next) void save(next);
    }
  };

  useEffect(() => {
    if (!edited) return;
    pending.current = edited;
    const timer = setTimeout(() => void save(edited), SAVE_DELAY);
    return () => clearTimeout(timer);
    // `attempt` re-runs a failed save on request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edited, attempt]);
  useEffect(
    () => {
      closed.current = false;
      return () => {
        closed.current = true;
        if (pending.current) void save(pending.current);
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const value = edited ?? query.data;
  const update = (patch: Partial<UserSettings>) => {
    setSaveError(null);
    setEdited((current) => {
      const base = current ?? query.data;
      return base ? { ...base, ...patch } : current;
    });
  };
  // The model page applies its choice through here.
  useEffect(() => onApplySettings(update));
  if (!value)
    return query.error ? (
      <ErrorScreen error={query.error} retry={() => void query.refetch()} />
    ) : (
      <Loading />
    );
  return (
    <StudySettings
      value={value}
      update={update}
      openModels={() =>
        router.push({
          pathname: "/settings-model",
          params: { model: value.default_ai_model ?? "" },
        })
      }
      models={
        models.data
          ? models.data.models.map((m) => ({
              value: m.model,
              label: m.label || m.model,
              provider: m.provider,
            }))
          : null
      }
      defaultModel={
        models.data?.models.find((m) => m.model === models.data?.default_model)
          ?.label
      }
      modelsError={models.error}
      retryModels={() => void models.refetch()}
      canNotify={!guest}
      canUseAi={!guest}
      saveError={saveError}
      retrySave={() => {
        setSaveError(null);
        setAttempt((n) => n + 1);
      }}
    />
  );
}
