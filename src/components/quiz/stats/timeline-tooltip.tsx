"use client";

import type { TooltipContentProps, TooltipValueType } from "recharts";

import { cn } from "@/lib/utils";
import type { TimelineEntry } from "@/types/quiz-stats";

type TimelineTooltipData = Partial<TimelineEntry> & Record<string, unknown>;

interface TimelineTooltipProps extends Partial<
  TooltipContentProps<TooltipValueType, string | number>
> {
  primaryDataKey?: string;
  primaryLabel?: string;
  primaryFormatter?: (value: TooltipValueType) => string;
}

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
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

function formatAccuracy(
  correct: number | undefined,
  total: number | undefined,
) {
  if (total === undefined || total === 0 || correct === undefined) {
    return "0,0%";
  }

  return `${((correct / total) * 100).toLocaleString("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`;
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

export function TimelineTooltip({
  active,
  payload = [],
  label,
  primaryDataKey,
  primaryLabel,
  primaryFormatter,
}: TimelineTooltipProps) {
  if (active !== true || payload.length === 0) {
    return null;
  }

  const primaryItem =
    primaryDataKey === undefined
      ? payload[0]
      : (payload.find((item) => item.dataKey === primaryDataKey) ?? payload[0]);
  const entry = primaryItem.payload as TimelineTooltipData | undefined;

  if (entry === undefined) {
    return null;
  }

  const date =
    typeof entry.date === "string"
      ? entry.date
      : typeof label === "string"
        ? label
        : "";
  const totalAnswers = entry.total_answers;
  const correctAnswers = entry.correct_answers;

  return (
    <div className="border-border/50 bg-background grid min-w-52 gap-2 rounded-lg border px-3 py-2 text-xs shadow-xl">
      <div className="font-medium">
        {date === "" ? label : formatDate(date)}
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
        <TooltipRow label="Sesje" value={formatNumber(entry.sessions_count)} />
        <TooltipRow label="Odpowiedzi" value={formatNumber(totalAnswers)} />
        <TooltipRow label="Poprawne" value={formatNumber(correctAnswers)} />
        <TooltipRow
          label="Wynik"
          value={formatAccuracy(correctAnswers, totalAnswers)}
        />
        <TooltipRow
          label="Łączny czas"
          value={formatTime(entry.total_study_time_seconds)}
        />
      </div>
    </div>
  );
}
