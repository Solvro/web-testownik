import type {
  AIAccountLimitRow,
  AIModelRow,
  AIUsageSettingsRow,
} from "@/types/ai-admin";
import type { AccountLevel, AccountType } from "@/types/user";
import { ACCOUNT_LEVELS, ACCOUNT_TYPES } from "@/types/user";

export {
  ACCOUNT_LEVELS as accountLevels,
  ACCOUNT_LEVEL_LABELS as accountLevelLabels,
  ACCOUNT_TYPES as accountTypes,
  ACCOUNT_TYPE_LABELS as accountTypeLabels,
} from "@/types/user";

export const aiAdminKeys = {
  permissions: ["ai-admin-permissions"] as const,
  limits: ["ai-admin-limits"] as const,
  stats: ["ai-admin-stats"] as const,
  usersRoot: ["ai-admin-users"] as const,
  users: (query: string, overridesOnly: boolean) =>
    ["ai-admin-users", query, overridesOnly] as const,
  models: ["ai-admin-models"] as const,
  settings: ["ai-admin-settings"] as const,
  override: (userId: string) => ["ai-admin-user-override", userId] as const,
  events: (userId: string, offset: number) =>
    ["ai-admin-user-events", userId, offset] as const,
};

export function formatNumber(
  value: string | number | null | undefined,
  digits = 0,
) {
  return Number(value ?? 0).toLocaleString("pl-PL", {
    maximumFractionDigits: digits,
  });
}

export function formatRequestCount(value: number) {
  return `${value.toLocaleString("pl-PL")} ${value === 1 ? "żądanie" : "żądań"}`;
}

function normalizeDecimal(value: string) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toString() : value;
}

export function normalizeModelRows(rows: AIModelRow[]) {
  return rows.map((row) => ({
    ...row,
    input_weight: normalizeDecimal(row.input_weight),
    output_weight: normalizeDecimal(row.output_weight),
    cached_weight: normalizeDecimal(row.cached_weight),
  }));
}

export function normalizeLimitRows(rows: AIAccountLimitRow[]) {
  return rows.toSorted((left, right) => {
    const accountTypeOrder =
      ACCOUNT_TYPES.indexOf(left.account_type) -
      ACCOUNT_TYPES.indexOf(right.account_type);
    return accountTypeOrder === 0
      ? ACCOUNT_LEVELS.indexOf(left.account_level) -
          ACCOUNT_LEVELS.indexOf(right.account_level)
      : accountTypeOrder;
  });
}

export function normalizeSettings(row: AIUsageSettingsRow) {
  return {
    ...row,
    grace_buffer_credits: normalizeDecimal(row.grace_buffer_credits),
  };
}

export function limitCellKey(
  accountType: AccountType,
  accountLevel: AccountLevel,
) {
  return `${accountType}:${accountLevel}`;
}
