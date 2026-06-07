"use client";

import { useMemo, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useQuizHourly } from "@/hooks/use-quiz-stats";
import type { StatsScope } from "@/types/quiz-stats";

import { ChartCard } from "./chart-card";

interface HourlyChartProps {
  quizId: string;
  canViewAll: boolean;
}

const chartConfig = {
  sessions_count: {
    label: "Sesje",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function HourlyChart({ quizId, canViewAll }: HourlyChartProps) {
  const [scope, setScope] = useState<StatsScope>("me");
  const { data, isFetching, isPending } = useQuizHourly(quizId, scope);
  const isRefreshing = isFetching && !isPending;

  const chartData = useMemo(
    () =>
      data?.map((d) => ({
        hour: d.hour.toString().padStart(2, "0"),
        sessions_count: d.sessions_count,
      })) ?? [],
    [data],
  );

  const hasData = useMemo(
    () => data?.some((d) => d.sessions_count > 0) ?? false,
    [data],
  );

  return (
    <ChartCard
      title="Aktywność w ciągu doby"
      description="Sesje wg godziny"
      scope={scope}
      onScopeChange={setScope}
      canViewAll={canViewAll}
      isLoading={isPending}
      isRefreshing={isRefreshing}
      isEmpty={!hasData}
    >
      <ChartContainer config={chartConfig} className="max-h-87.5 min-h-62.5">
        <RadarChart data={chartData} accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent />} />
          <PolarAngleAxis
            dataKey="hour"
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <PolarGrid />
          <Radar
            dataKey="sessions_count"
            fill="var(--color-sessions_count)"
            fillOpacity={0.3}
            stroke="var(--color-sessions_count)"
            strokeWidth={2}
          />
        </RadarChart>
      </ChartContainer>
    </ChartCard>
  );
}
