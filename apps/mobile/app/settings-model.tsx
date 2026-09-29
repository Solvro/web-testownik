import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import ModelList from "../src/components/settings/ModelList";
import { ErrorScreen, Loading } from "../src/components/ui";
import { api } from "../src/lib/api";
import { haptics } from "../src/lib/haptics";
import { useSession } from "../src/lib/session";
import { applySettings } from "../src/lib/settings-bus";

/** Study Settings › Model: pick the assistant's model from a full list. */
export default function SettingsModel() {
  const { model } = useLocalSearchParams<{ model?: string }>();
  const { user } = useSession();
  const [selected, setSelected] = useState<string | null>(model || null);
  // Same cache as Study Settings.
  const models = useQuery({
    queryKey: ["ai-models", user?.id],
    queryFn: () =>
      api.request<{
        models: { model: string; label: string; provider?: string }[];
        default_model: string | null;
      }>("ai/models/"),
  });
  if (models.isPending) return <Loading />;
  if (!models.data)
    return (
      <ErrorScreen error={models.error} retry={() => void models.refetch()} />
    );
  return (
    <ModelList
      models={models.data.models.map((m) => ({
        value: m.model,
        label: m.label || m.model,
        provider: m.provider,
      }))}
      defaultModel={models.data.models.find(
        (m) => m.model === models.data.default_model,
      )}
      selected={selected}
      select={(value) => {
        haptics.selection();
        setSelected(value);
        applySettings({ default_ai_model: value });
      }}
    />
  );
}
