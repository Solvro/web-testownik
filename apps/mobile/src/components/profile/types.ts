import type { UsageWindowView } from "../../lib/ai-usage";
import type { LanguagePreference } from "../../lib/locale";

export interface ProfileContentProps {
  name: string;
  photo?: string | null;
  tier: "basic" | "silver" | "gold" | string;
  language: LanguagePreference;
  setLanguage: (value: LanguagePreference) => void;
  /** null for accounts without AI (guests) or while it cannot be shown. */
  usage: {
    session: UsageWindowView;
    weekly: UsageWindowView;
    exhausted: boolean;
  } | null;
  sync: { offline: boolean; pending: number; error: unknown; run: () => void };
  changePhoto: () => void;
  openSettings: () => void;
  openUsage: (tab: "session" | "week") => void;
  openWrapped: () => void;
  openNotifications: () => void;
  openAccount: () => void;
  openFeedback: () => void;
  openLink: (url: string) => void;
  version: string;
  webUrl: string;
  signOut: () => void;
}
