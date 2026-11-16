import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  router,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import ModelList from "../src/components/settings/ModelList";
import type { ModelListProps } from "../src/components/settings/ModelList.types";
import {
  ErrorScreen,
  ErrorState,
  Label,
  Loading,
  notify,
} from "../src/components/ui";
import { api } from "../src/lib/api";
import { haptics } from "../src/lib/haptics";
import { useSession } from "../src/lib/session";
import { useStudySettings } from "../src/lib/use-study-settings";
import { useQuizAiModel } from "../src/lib/quiz-ai-model";
import { useLocale } from "../src/lib/locale";
import { userError } from "../src/lib/user-error";

/** Study Settings › Model: pick the assistant's model from a full list. */
export default function SettingsModel() {
  const { quiz } = useLocalSearchParams<{ quiz?: string }>();
  const { t } = useLocale();
  const override = useQuizAiModel(quiz);
  const [client] = useState(() => api.forSession());
  const { user } = useSession();
  const pending = useRef(false);
  const mounted = useRef(true);
  const allowRemoval = useRef(false);
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  usePreventRemove(saving, ({ data }) => {
    if (allowRemoval.current) navigation.dispatch(data.action);
  });
  // Same cache as Study Settings.
  const models = useQuery({
    queryKey: ["ai-models", user?.id],
    networkMode: "always",
    queryFn: ({ signal }) =>
      client.request<{
        models: { model: string; label: string; provider?: string }[];
        default_model: string | null;
      }>("ai/models/", { signal }),
  });
  // A picker pushed above an iOS formSheet can have no native Back button.
  // Keep Close available during loading and errors as well as the model list.
  const controls = (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: Platform.OS !== "ios" && !saving,
          gestureEnabled: !saving,
        }}
      />
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="xmark"
            accessibilityLabel={t("Zamknij wybór modelu", "Close model picker")}
            disabled={saving}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          >
            {t("Zamknij", "Close")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
  if (models.isPending || (quiz && override.overridePending))
    return (
      <>
        {controls}
        <Loading />
      </>
    );
  if (quiz && override.overrideError)
    return (
      <>
        {controls}
        <ErrorScreen
          error={override.overrideError}
          retry={() => void override.refetch()}
        />
      </>
    );
  if (!models.data)
    return (
      <>
        {controls}
        <ErrorScreen error={models.error} retry={() => void models.refetch()} />
      </>
    );
  const defaultModel = quiz
    ? override.accountLoaded
      ? (override.accountModel ?? models.data.default_model)
      : null
    : models.data.default_model;
  return (
    <View style={{ flex: 1 }}>
      {controls}
      {saving ? (
        <View
          style={{
            padding: 12,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <ActivityIndicator />
          <Label>{t("Zapisuję model…", "Saving model…")}</Label>
        </View>
      ) : null}
      {quiz ? (
        <ModelList
          disabled={saving}
          scope="quiz"
          models={models.data.models.map((m) => ({
            value: m.model,
            label: m.label || m.model,
            provider: m.provider,
          }))}
          defaultModel={
            models.data.models.find((m) => m.model === defaultModel) ??
            (defaultModel ? { label: defaultModel } : undefined)
          }
          selected={override.model}
          select={(value) => {
            if (pending.current) return;
            pending.current = true;
            setSaving(true);
            void override
              .select(value)
              .then(() => {
                if (!mounted.current) return;
                allowRemoval.current = true;
                haptics.selection();
                router.back();
              })
              .catch((error: unknown) => {
                if (mounted.current)
                  notify(
                    t("Nie zapisano modelu", "Couldn’t Save Model"),
                    userError(error, t),
                  );
              })
              .finally(() => {
                pending.current = false;
                if (mounted.current) setSaving(false);
              });
          }}
        />
      ) : (
        <AccountModelPicker
          models={models.data.models.map((m) => ({
            value: m.model,
            label: m.label || m.model,
            provider: m.provider,
          }))}
          defaultModel={
            models.data.models.find((m) => m.model === defaultModel) ??
            (defaultModel ? { label: defaultModel } : undefined)
          }
        />
      )}
    </View>
  );
}

function AccountModelPicker(
  props: Pick<ModelListProps, "models" | "defaultModel">,
) {
  const { t } = useLocale();
  const { query, value, saved, saver, update } = useStudySettings();
  if (!value)
    return query.error ? (
      <ErrorScreen error={query.error} retry={() => void query.refetch()} />
    ) : (
      <Loading />
    );
  return (
    <View style={{ flex: 1 }}>
      {saved.error ? (
        <ErrorState
          title={t("Nie zapisano zmian", "Changes Not Saved")}
          error={saved.error}
          retry={() => void saver.retry()}
        />
      ) : null}
      <ModelList
        {...props}
        scope="account"
        selected={value.default_ai_model}
        select={(model) => {
          haptics.selection();
          update({ default_ai_model: model });
        }}
      />
    </View>
  );
}
