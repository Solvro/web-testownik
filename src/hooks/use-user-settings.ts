import { useDebouncer } from "@tanstack/react-pacer";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { quizDetailQueryKey } from "@/components/quiz/helpers/utils";
import { getUserService } from "@/services";
import type { QuizWithUserProgress } from "@/types/quiz";
import type { UserSettings } from "@/types/user";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

export const userSettingsQueryKey = ["user-settings"] as const;
const SETTINGS_UPDATE_DEBOUNCE_MS = 500;

interface UpdateUserSettingsVariables {
  settings: UserSettings;
  version: number;
}

function setQuizSettingsInCache(
  queryClient: QueryClient,
  quizId: string | undefined,
  settings: UserSettings,
) {
  if (quizId === undefined) {
    return;
  }

  queryClient.setQueryData<QuizWithUserProgress>(
    quizDetailQueryKey(quizId),
    (previous) =>
      previous == null ? previous : { ...previous, user_settings: settings },
  );
}

export function useUserSettings({
  enabled = true,
  placeholderData,
}: { enabled?: boolean; placeholderData?: UserSettings } = {}) {
  return useQuery({
    queryKey: userSettingsQueryKey,
    queryFn: async () => getUserService().getUserSettings(),
    enabled,
    placeholderData,
  });
}

export function useUpdateUserSettings({ quizId }: { quizId?: string } = {}) {
  const queryClient = useQueryClient();
  const versionRef = useRef(0);

  const mutation = useMutation({
    mutationFn: async ({ settings }: UpdateUserSettingsVariables) =>
      getUserService().updateUserSettings(settings),
    onError: (error, variables) => {
      if (variables.version !== versionRef.current) {
        return;
      }

      console.error("Error updating settings:", error);
      toast.error("Wystąpił błąd podczas aktualizacji ustawień.");

      void queryClient.invalidateQueries({ queryKey: userSettingsQueryKey });

      if (quizId === undefined) {
        void queryClient.invalidateQueries({ queryKey: ["quiz"] });
      } else {
        void queryClient.invalidateQueries({
          queryKey: quizDetailQueryKey(quizId),
        });
      }
    },
    onSuccess: (updatedSettings, variables) => {
      if (variables.version !== versionRef.current) {
        return;
      }

      queryClient.setQueryData<UserSettings>(
        userSettingsQueryKey,
        updatedSettings,
      );
      setQuizSettingsInCache(queryClient, quizId, updatedSettings);

      if (quizId === undefined) {
        void queryClient.invalidateQueries({ queryKey: ["quiz"] });
      }
    },
  });

  const runMutation = mutation.mutate;

  const settingsUpdateDebouncer = useDebouncer(
    (variables: UpdateUserSettingsVariables) => {
      runMutation(variables);
    },
    { wait: SETTINGS_UPDATE_DEBOUNCE_MS },
  );

  const mutate = useCallback(
    (settings: Partial<UserSettings>) => {
      versionRef.current += 1;
      const version = versionRef.current;

      void queryClient.cancelQueries({ queryKey: userSettingsQueryKey });

      let optimisticSettings: UserSettings = DEFAULT_USER_SETTINGS;

      queryClient.setQueryData<UserSettings>(
        userSettingsQueryKey,
        (previousSettings) => {
          optimisticSettings = {
            ...(previousSettings ?? DEFAULT_USER_SETTINGS),
            ...settings,
          };

          return optimisticSettings;
        },
      );
      setQuizSettingsInCache(queryClient, quizId, optimisticSettings);

      settingsUpdateDebouncer.maybeExecute({
        settings: optimisticSettings,
        version,
      });
    },
    [queryClient, quizId, settingsUpdateDebouncer],
  );

  return {
    ...mutation,
    mutate,
  };
}
