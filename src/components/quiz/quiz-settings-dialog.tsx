"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { SettingsForm } from "@/components/profile/settings-form";
import { quizDetailQueryKey } from "@/components/quiz/helpers/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/hooks/use-user-settings";
import { deriveSettings } from "@/lib/session-utils";
import type { QuizWithUserProgress } from "@/types/quiz";
import type { UserSettings } from "@/types/user";

interface QuizSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
}

export function QuizSettingsDialog({
  open,
  onOpenChange,
  quizId,
}: QuizSettingsDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const quizSettings = queryClient.getQueryData<QuizWithUserProgress>(
    quizDetailQueryKey(quizId),
  )?.user_settings;
  const initialSettings = deriveSettings(quizSettings);
  const {
    data: settings,
    isPending,
    isPlaceholderData,
  } = useUserSettings({
    enabled: open,
    placeholderData: initialSettings,
  });
  const updateUserSettings = useUpdateUserSettings({ quizId });

  const handleSettingChange = <K extends keyof UserSettings>(
    name: K,
    value: UserSettings[K],
  ) => {
    updateUserSettings.mutate({ [name]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ustawienia quizów</DialogTitle>
          <DialogDescription>
            Te ustawienia dotyczą wszystkich quizów, więcej opcji znajdziesz w{" "}
            <Link href="/profile?tab=settings">profilu</Link>
          </DialogDescription>
        </DialogHeader>
        <SettingsForm
          settings={settings ?? initialSettings}
          onSettingChange={handleSettingChange}
          disabled={isPending || isPlaceholderData}
          variant="plain"
        />
      </DialogContent>
    </Dialog>
  );
}
