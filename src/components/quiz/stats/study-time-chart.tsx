"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useQuizTimeline } from "@/hooks/use-quiz-stats";
import type { StatsScope } from "@/types/quiz-stats";

import { ChartCard } from "./chart-card";

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

function formatMinutes(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m.toString()}:${s.toString().padStart(2, "0")}`;
}

export function StudyTimeChart({ quizId, canViewAll }: StudyTimeChartProps) {
  const [scope, setScope] = useState<StatsScope>("me");
  const { data: raw, isFetching, isPending } = useQuizTimeline(quizId, scope);
  const isRefreshing = isFetching && !isPending;

  const data = useMemo(
    () =>
      raw
        ?.filter((d) => d.sessions_count > 0)
        .map((d) => ({
          date: d.date,
          avgTime: Number(
            (d.total_study_time_seconds / d.sessions_count / 60).toFixed(2),
          ),
        })) ?? [],
    [raw],
  );

  return (
    <ChartCard
      title="Średni czas rozwiązywania w czasie"
      description="Czas kolejnych sesji (30 dni)"
      scope={scope}
      onScopeChange={setScope}
      canViewAll={canViewAll}
      isLoading={isPending}
      isRefreshing={isRefreshing}
      isEmpty={data.length === 0}
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
            tickFormatter={(v: number) => formatMinutes(v)}
            width={45}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => {
                  const date = new Date(
                    typeof value === "string" || typeof value === "number"
                      ? value
                      : "",
                  );
                  return date.toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "long",
                  });
                }}
                formatter={(value) => [formatMinutes(Number(value)), undefined]}
              />
            }
          />
          <Line
            dataKey="avgTime"
            type="monotone"
            stroke="var(--color-avgTime)"
            strokeWidth={2}
            dot={data.length <= 15}
          />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}
