"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { useQuizTimeline } from "@/hooks/use-quiz-stats";
import type { StatsScope } from "@/types/quiz-stats";

import { ChartCard } from "./chart-card";
import { TimelineTooltip } from "./timeline-tooltip";

interface SessionsChartProps {
  quizId: string;
  canViewAll: boolean;
}

const chartConfig = {
  sessions_count: {
    label: "Sesje",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function SessionsChart({ quizId, canViewAll }: SessionsChartProps) {
  const [scope, setScope] = useState<StatsScope>("me");
  const { data, isFetching, isPending } = useQuizTimeline(quizId, scope);
  const isRefreshing = isFetching && !isPending;

  const hasData = data?.some((d) => d.sessions_count > 0) ?? false;

  return (
    <ChartCard
      title="Liczba uruchomień quizu"
      description="Ostatnie 30 dni"
      scope={scope}
      onScopeChange={setScope}
      canViewAll={canViewAll}
      isLoading={isPending}
      isRefreshing={isRefreshing}
      isEmpty={!hasData}
    >
      <ChartContainer config={chartConfig} className="min-h-62.5">
        <BarChart data={data} accessibilityLayer>
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
            allowDecimals={false}
            width={30}
          />
          <ChartTooltip
            content={
              <TimelineTooltip
                primaryDataKey="sessions_count"
                primaryLabel="Sesje"
                primaryFormatter={(value) =>
                  Number(value).toLocaleString("pl-PL")
                }
              />
            }
          />
          <Bar
            dataKey="sessions_count"
            fill="var(--color-sessions_count)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
