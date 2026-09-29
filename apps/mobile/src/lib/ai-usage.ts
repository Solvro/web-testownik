import type { AIUsageSummary, AIUsageWindow } from "@testownik/core/ai/usage";

import type { Translate } from "./user-error";

export interface UsageWindowView {
  unlimited: boolean;
  /** 0–1 */
  fraction: number;
  resets: string | null;
}

// Mirrors the web's usage card: percent of the window used and when it renews.
export function usageWindow(
  window: AIUsageWindow,
  t: Translate,
  now = Date.now(),
): UsageWindowView {
  const limit = window.limit === null ? null : Number(window.limit);
  const used = Number(window.used);
  const fraction =
    limit === null
      ? 0
      : !Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0
        ? 1
        : Math.min(1, Math.max(0, used / limit));
  return {
    unlimited: limit === null,
    fraction,
    resets: resetsIn(window.resets_at, t, now),
  };
}

function resetsIn(value: string | null, t: Translate, now: number) {
  if (value === null) return null;
  const remaining = new Date(value).getTime() - now;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 60_000) return t("Odnawia się za chwilę", "Renews shortly");
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60)
    return t(`Odnowienie za ${minutes} min`, `Renews in ${minutes} min`);
  const hours = Math.round(minutes / 60);
  if (hours < 24)
    return t(`Odnowienie za ${hours} godz.`, `Renews in ${hours} h`);
  const days = Math.round(hours / 24);
  return t(
    `Odnowienie za ${days} ${days === 1 ? "dzień" : "dni"}`,
    `Renews in ${days} ${days === 1 ? "day" : "days"}`,
  );
}

export type { AIUsageSummary };

/** One name per limit window, shared by the assistant menu, Profile and the usage sheet. */
export function usageWindowLabels(t: Translate) {
  return {
    session: t("Limit 5-godzinny", "5-Hour Limit"),
    weekly: t("Limit tygodniowy", "Weekly Limit"),
  };
}
