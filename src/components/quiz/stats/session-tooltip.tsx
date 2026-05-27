"use client";

import type { TooltipContentProps, TooltipValueType } from "recharts";

import { cn } from "@/lib/utils";
import type { SessionEntry } from "@/types/quiz-stats";

type SessionTooltipData = Partial<SessionEntry> & {
  sessionIndex?: number;
};

interface SessionTooltipProps extends Partial<
  TooltipContentProps<TooltipValueType, string | number>
> {
  primaryDataKey?: string;
  primaryLabel?: string;
  primaryFormatter?: (value: TooltipValueType) => string;
}

function formatDateTime(value: string | null | undefined): string {
  if (value == null) {
    return "-";
  }

  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(value = 0): string {
  return value.toLocaleString("pl-PL");
}

function formatTime(seconds = 0): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h.toString()}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return `${m.toString()}:${s.toString().padStart(2, "0")}`;
}

function TooltipRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono font-medium tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function SessionTooltip({
  active,
  payload = [],
  primaryDataKey,
  primaryLabel,
  primaryFormatter,
}: SessionTooltipProps) {
  if (active !== true || payload.length === 0) {
    return null;
  }

  const primaryItem =
    primaryDataKey === undefined
      ? payload[0]
      : (payload.find((item) => item.dataKey === primaryDataKey) ?? payload[0]);
  const entry = primaryItem.payload as SessionTooltipData | undefined;

  if (entry === undefined) {
    return null;
  }

  return (
    <div className="border-border/50 bg-background grid min-w-56 gap-2 rounded-lg border px-3 py-2 text-xs shadow-xl">
      <div className="font-medium">
        Sesja {entry.sessionIndex?.toLocaleString("pl-PL") ?? "-"}
      </div>
      {primaryLabel !== undefined &&
      primaryItem.value !== undefined &&
      primaryFormatter !== undefined ? (
        <div
          className={cn(
            "border-border/60 grid gap-1.5 border-b pb-2",
            "last:border-b-0 last:pb-0",
          )}
        >
          <TooltipRow
            label={primaryLabel}
            value={primaryFormatter(primaryItem.value)}
          />
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <TooltipRow label="Start" value={formatDateTime(entry.started_at)} />
        <TooltipRow label="Koniec" value={formatDateTime(entry.ended_at)} />
        <TooltipRow
          label="Odpowiedzi"
          value={formatNumber(entry.total_answers)}
        />
        <TooltipRow
          label="Poprawne"
          value={formatNumber(entry.correct_answers)}
        />
        <TooltipRow
          label="Wynik"
          value={`${(entry.accuracy ?? 0).toLocaleString("pl-PL", {
            maximumFractionDigits: 1,
            minimumFractionDigits: 1,
          })}%`}
        />
        <TooltipRow label="Czas" value={formatTime(entry.study_time_seconds)} />
      </div>
    </div>
  );
}
