import type { AiModelProvider } from "@/lib/ai/models";
import type { AIUsageSummary } from "@/types/ai-usage";
import type { AccountLevel, AccountType } from "@/types/user";

export interface AIAdminPermissions {
  view_stats: boolean;
  manage_limits: boolean;
}

export interface AIAccountLimitRow {
  account_type: AccountType;
  account_level: AccountLevel;
  credits_session: number | null;
  credits_weekly: number | null;
  updated_at: string | null;
}

export interface AILimitsResetResult {
  reset_at: string;
}

export interface AIAdminStats {
  totals: Record<string, string | number | null>;
  by_model: {
    model: string;
    label: string;
    provider: AiModelProvider;
    credits: string;
    events: number;
  }[];
  by_scope: { scope: string; credits: string; events: number }[];
  top_users: {
    user_id: string;
    user__email: string | null;
    credits: string;
    events: number;
  }[];
  daily: { day: string; credits: string; events: number }[];
  limits_enabled: boolean;
}

export interface AIAdminUser {
  id: string;
  email: string | null;
  name: string;
  account_type: AccountType;
  account_level: AccountLevel;
  has_override: boolean;
  usage: AIUsageSummary;
}

export interface AIModelRow {
  original_model?: string;
  order?: number;
  model: string;
  label: string;
  provider: AiModelProvider;
  minimum_account_level: AccountLevel;
  input_weight: string;
  output_weight: string;
  cache_read_weight: string;
  cache_write_weight: string;
  active: boolean;
}

export interface AIUsageSettingsRow {
  limits_enabled: boolean;
  grace_buffer_credits: string;
  staff_bypass_limits: boolean;
  default_model: string;
  fallback_model: string | null;
  fallback_throttle_seconds: number;
  fallback_max_output_tokens: number;
  updated_at: string;
}

export interface AIUserLimitOverride {
  credits_session: number | null;
  credits_weekly: number | null;
  note: string;
}

export interface AIUsageEventRow {
  id: number;
  scope: string;
  model: string;
  credits: string;
  input_tokens: number;
  output_tokens: number;
  aborted: boolean;
  error: string;
  created_at: string;
}

export interface AIUsageEventPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: AIUsageEventRow[];
}
