import type { UserSettings } from "@testownik/core/user/types";

export interface StudySettingsProps {
  value: UserSettings;
  update: (patch: Partial<UserSettings>) => void;
  /** null when the account may not choose a model. */
  models: { value: string; label: string; provider?: string }[] | null;
  /** What "Default" currently resolves to, as the web shows it. */
  defaultModel?: string;
  modelsError: unknown;
  retryModels: () => void;
  /** iOS lists models on their own page, like Settings pickers. */
  openModels: () => void;
  /** Guests cannot manage notifications or use AI, as on the web. */
  canNotify: boolean;
  canUseAi: boolean;
  saveError: unknown;
  retrySave: () => void;
}
