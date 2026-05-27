"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { useQuizTimeline } from "@/hooks/use-quiz-stats";
import type { StatsScope } from "@/types/quiz-stats";

import { ChartCard } from "./chart-card";
import { TimelineTooltip } from "./timeline-tooltip";

interface ScoreChartProps {
  quizId: string;
  canViewAll: boolean;
}

const chartConfig = {
  accuracy: {
    label: "Wynik (%)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const TIMELINE_DAYS = 30;

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

export function ScoreChart({ quizId, canViewAll }: ScoreChartProps) {
  const [scope, setScope] = useState<StatsScope>("me");
  const {
    data: raw,
    isFetching,
    isPending,
  } = useQuizTimeline(quizId, scope, TIMELINE_DAYS);
  const isRefreshing = isFetching && !isPending;

  const data = useMemo(() => {
    const entriesByDate = new Map(raw?.map((entry) => [entry.date, entry]));
    const firstNonZeroEntry = raw?.find((entry) => entry.total_answers > 0);

    if (firstNonZeroEntry === undefined) {
      return [];
    }

    return getDaysThroughToday(firstNonZeroEntry.date).map((date) => {
      const entry = entriesByDate.get(date);

      return {
        date,
        sessions_count: entry?.sessions_count ?? 0,
        total_answers: entry?.total_answers ?? 0,
        correct_answers: entry?.correct_answers ?? 0,
        total_study_time_seconds: entry?.total_study_time_seconds ?? 0,
        accuracy:
          entry !== undefined && entry.total_answers > 0
            ? Number(
                ((entry.correct_answers / entry.total_answers) * 100).toFixed(
                  1,
                ),
              )
            : null,
      };
    });
  }, [raw]);

  const hasData = data.some((d) => d.accuracy !== null);

  return (
    <ChartCard
      title="Średni wynik w czasie"
      description="Wynik kolejnych sesji (30 dni)"
      scope={scope}
      onScopeChange={setScope}
      canViewAll={canViewAll}
      isLoading={isPending}
      isRefreshing={isRefreshing}
      isEmpty={!hasData}
    >
      <ChartContainer config={chartConfig} className="min-h-[250px]">
        <LineChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
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
          <YAxis
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v.toString()}%`}
            width={45}
          />
          <ChartTooltip
            content={
              <TimelineTooltip
                primaryDataKey="accuracy"
                primaryLabel="Wynik"
                primaryFormatter={(value) => `${String(value)}%`}
              />
            }
          />
          <Line
            dataKey="accuracy"
            type="monotone"
            stroke="var(--color-accuracy)"
            strokeWidth={2}
            dot={data.filter((d) => d.accuracy !== null).length <= 15}
          />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}
