"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { useQuizSessions, useQuizTimeline } from "@/hooks/use-quiz-stats";
import type { StatsScope } from "@/types/quiz-stats";

import { ChartCard } from "./chart-card";
import { ChartModeToggle } from "./chart-mode-toggle";
import type { ChartMode } from "./chart-mode-toggle";
import { SessionTooltip } from "./session-tooltip";
import { TimelineTooltip } from "./timeline-tooltip";

interface StudyTimeChartProps {
  quizId: string;
  canViewAll: boolean;
}

const chartConfig = {
  avgTime: {
    label: "Średni czas",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const TIMELINE_DAYS = 30;

function formatMinutes(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m.toString()}:${s.toString().padStart(2, "0")}`;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year.toString()}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDaysThroughToday(startDateKey: string): string[] {
  const start = parseDateKey(startDateKey);
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start > end) {
    return [formatDateKey(start)];
  }

  const days =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatDateKey(date);
  });
}

export function StudyTimeChart({ quizId, canViewAll }: StudyTimeChartProps) {
  const [scope, setScope] = useState<StatsScope>("me");
  const [mode, setMode] = useState<ChartMode>("sessions");
  const canUseSessions = scope === "me";
  const {
    data: raw,
    isFetching: isTimelineFetching,
    isPending: isTimelinePending,
  } = useQuizTimeline(quizId, scope, TIMELINE_DAYS);
  const {
    data: sessionsRaw,
    isFetching: isSessionsFetching,
    isPending: isSessionsPending,
  } = useQuizSessions(
    quizId,
    "me",
    TIMELINE_DAYS,
    mode === "sessions" && canUseSessions,
  );

  const effectiveMode = canUseSessions ? mode : "timeline";
  const isPending =
    effectiveMode === "sessions" ? isSessionsPending : isTimelinePending;
  const isRefreshing =
    effectiveMode === "sessions"
      ? isSessionsFetching && !isSessionsPending
      : isTimelineFetching && !isTimelinePending;

  const timelineData = useMemo(() => {
    const entriesByDate = new Map(raw?.map((entry) => [entry.date, entry]));
    const firstNonZeroEntry = raw?.find(
      (entry) => entry.sessions_count > 0 && entry.total_study_time_seconds > 0,
    );

    if (firstNonZeroEntry === undefined) {
      return [];
    }

    return getDaysThroughToday(firstNonZeroEntry.date).map((date, index) => {
      const entry = entriesByDate.get(date);
      const avgTime =
        entry !== undefined && entry.sessions_count > 0
          ? Number(
              (
                entry.total_study_time_seconds /
                entry.sessions_count /
                60
              ).toFixed(2),
            )
          : null;

      return {
        date,
        sessionIndex: index + 1,
        sessions_count: entry?.sessions_count ?? 0,
        total_answers: entry?.total_answers ?? 0,
        correct_answers: entry?.correct_answers ?? 0,
        total_study_time_seconds: entry?.total_study_time_seconds ?? 0,
        avgTime,
        sessionTimeMinutes: avgTime,
      };
    });
  }, [raw]);

  const sessionData = useMemo(
    () =>
      sessionsRaw?.map((entry, index) => ({
        ...entry,
        date: entry.started_at,
        sessionIndex: index + 1,
        sessions_count: 1,
        total_study_time_seconds: entry.study_time_seconds,
        avgTime: null,
        sessionTimeMinutes: Number((entry.study_time_seconds / 60).toFixed(2)),
      })) ?? [],
    [sessionsRaw],
  );

  const data = effectiveMode === "sessions" ? sessionData : timelineData;
  const hasData =
    effectiveMode === "sessions"
      ? sessionData.some((d) => d.study_time_seconds > 0)
      : timelineData.some((d) => d.avgTime !== null);
  const handleScopeChange = (nextScope: StatsScope) => {
    setScope(nextScope);

    if (nextScope === "all") {
      setMode("timeline");
    }
  };

  return (
    <ChartCard
      title="Czas rozwiązywania w czasie"
      description={
        effectiveMode === "sessions"
          ? "Czas kolejnych sesji (30 dni)"
          : "Średni dzienny czas sesji według dat startu (30 dni)"
      }
      scope={scope}
      onScopeChange={handleScopeChange}
      canViewAll={canViewAll}
      isLoading={isPending}
      isRefreshing={isRefreshing}
      isEmpty={!hasData}
      toolbar={
        <ChartModeToggle
          mode={effectiveMode}
          onModeChange={setMode}
          canUseSessions={canUseSessions}
        />
      }
    >
      <ChartContainer config={chartConfig} className="min-h-[250px]">
        <LineChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          {effectiveMode === "sessions" ? (
            <XAxis
              dataKey="sessionIndex"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => `#${value.toString()}`}
              interval="preserveStartEnd"
              minTickGap={24}
            />
          ) : (
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => {
                const date = new Date(value);
                return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}`;
              }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
          )}
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatMinutes(v)}
            width={45}
          />
          <ChartTooltip
            content={
              effectiveMode === "sessions" ? (
                <SessionTooltip
                  primaryDataKey="sessionTimeMinutes"
                  primaryLabel="Czas sesji"
                  primaryFormatter={(value) => formatMinutes(Number(value))}
                />
              ) : (
                <TimelineTooltip
                  primaryDataKey="avgTime"
                  primaryLabel="Średni czas"
                  primaryFormatter={(value) => formatMinutes(Number(value))}
                />
              )
            }
          />
          <Line
            dataKey={
              effectiveMode === "sessions" ? "sessionTimeMinutes" : "avgTime"
            }
            type="monotone"
            stroke="var(--color-avgTime)"
            strokeWidth={2}
            dot={
              data.filter((d) =>
                effectiveMode === "sessions"
                  ? "sessionTimeMinutes" in d
                  : d.avgTime !== null,
              ).length <= 15
            }
          />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}
