import type { AIUsageSummary, AIUsageWindow } from "@/types/ai-usage";

const compactCreditsFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 2,
});
const integerCreditsFormatter = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 0,
});
const shortResetFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const fullResetFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatAICompactCredits(value: string | number) {
  return compactCreditsFormatter.format(Number(value)).toLowerCase();
}

export function formatAICredits(value: string | number) {
  return integerCreditsFormatter.format(Number(value));
}

export function isAIUsageUnlimited(
  usage: Pick<AIUsageSummary, "limits_enabled"> & {
    session: Pick<AIUsageWindow, "limit">;
    weekly: Pick<AIUsageWindow, "limit">;
  },
) {
  return (
    !usage.limits_enabled ||
    (usage.session.limit === null && usage.weekly.limit === null)
  );
}

export function isAIUsageWindowUnlimited(window: Pick<AIUsageWindow, "limit">) {
  return window.limit === null;
}

export function formatAIResetAt(
  value: string | null,
  variant: "short" | "full" = "short",
  relativeTo?: number,
) {
  if (value === null) {
    return null;
  }
  const resetAt = new Date(value);
  if (relativeTo !== undefined) {
    const remaining = resetAt.getTime() - relativeTo;
    if (remaining <= 0) {
      return "teraz";
    }
    if (remaining <= 90_000) {
      return `za ${Math.max(1, Math.ceil(remaining / 1000)).toString()} s`;
    }
    if (remaining <= 60 * 60 * 1000) {
      return `za ${Math.ceil(remaining / 60_000).toString()} min`;
    }
    if (remaining < 24 * 60 * 60 * 1000) {
      const totalMinutes = Math.ceil(remaining / 60_000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes === 0
        ? `za ${hours.toString()} godz.`
        : `za ${hours.toString()} godz. ${minutes.toString()} min`;
    }
  }
  return (variant === "full" ? fullResetFormatter : shortResetFormatter).format(
    resetAt,
  );
}

export function usageWindowPercent(window: AIUsageWindow): number {
  if (window.limit === null) {
    return 0;
  }
  const used = Number(window.used);
  const limit = Number(window.limit);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, (used / limit) * 100));
}
