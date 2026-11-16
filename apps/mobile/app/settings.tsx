import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";

import StudySettings from "../src/components/settings/StudySettings";
import { ErrorScreen, Loading } from "../src/components/ui";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { useStudySettings } from "../src/lib/use-study-settings";

// Settings apply after a short pause, with one save chain across screen visits.

export default function Settings() {
  const { user } = useSession();
  const [client] = useState(() => api.forSession());
  const { query, value, saved, saver, update } = useStudySettings();
  const guest = user?.account_type === "guest";
  const models = useQuery({
    queryKey: ["ai-models", user?.id],
    networkMode: "always",
    queryFn: ({ signal }) =>
      client.request<{
        models: { model: string; label: string; provider?: string }[];
        default_model: string | null;
      }>("ai/models/", { signal }),
    enabled: !guest && user?.account_level !== "basic",
  });
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
      openModels={() => router.push("/settings-model")}
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
      saveError={saved.error}
      retrySave={() => saver.retry()}
    />
  );
}
