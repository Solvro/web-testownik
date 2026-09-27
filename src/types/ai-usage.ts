export interface AIUsageWindow {
  used: string;
  limit: string | null;
  remaining: string | null;
  resets_at: string | null;
}

export interface AIUsageBreakdown {
  model?: string;
  scope?: string;
  credits: string;
  events: number;
}

export interface AIUsageSummary {
  session: AIUsageWindow;
  weekly: AIUsageWindow;
  limits_enabled: boolean;
  exhausted: boolean;
  blocked_until: string | null;
  fallback_resets_at: string | null;
  active_models: string[];
  fallback_model: string | null;
  daily: { date: string; credits: string; events: number }[];
  by_model: AIUsageBreakdown[];
  by_scope: AIUsageBreakdown[];
}

export const AI_USAGE_SCOPE_LABELS: Record<string, string> = {
  chat: "Czat",
  explain: "Wyjaśnienia",
  hint: "Wskazówki",
  quiz_generation: "Generowanie quizów",
  adjustment: "Korekty",
};
