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

export function ScoreChart({ quizId, canViewAll }: ScoreChartProps) {
  const [scope, setScope] = useState<StatsScope>("me");
  const { data: raw, isFetching, isPending } = useQuizTimeline(quizId, scope);
  const isRefreshing = isFetching && !isPending;

  const data = useMemo(
    () =>
      raw
        ?.filter((d) => d.total_answers > 0)
        .map((d) => ({
          date: d.date,
          accuracy: Number(
            ((d.correct_answers / d.total_answers) * 100).toFixed(1),
          ),
        })) ?? [],
    [raw],
  );

  return (
    <ChartCard
      title="Średni wynik w czasie"
      description="Wynik kolejnych sesji (30 dni)"
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
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v.toString()}%`}
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
                formatter={(value) => [`${String(value)}%`, "Wynik"]}
              />
            }
          />
          <Line
            dataKey="accuracy"
            type="monotone"
            stroke="var(--color-accuracy)"
            strokeWidth={2}
            dot={data.length <= 15}
          />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}
