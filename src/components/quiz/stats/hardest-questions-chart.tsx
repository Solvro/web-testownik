"use client";

import { useMemo, useState } from "react";
import { Label, Pie, PieChart } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useQuizHardestQuestions } from "@/hooks/use-quiz-stats";
import type { StatsScope } from "@/types/quiz-stats";

import { ChartCard } from "./chart-card";

interface HardestQuestionsChartProps {
  quizId: string;
  canViewAll: boolean;
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
];

export function HardestQuestionsChart({
  quizId,
  canViewAll,
}: HardestQuestionsChartProps) {
  const [scope, setScope] = useState<StatsScope>("me");
  const { data, isFetching, isPending } = useQuizHardestQuestions(
    quizId,
    scope,
  );
  const isRefreshing = isFetching && !isPending;

  const totalWrong = useMemo(
    () => data?.reduce((sum, q) => sum + q.wrong_answers, 0) ?? 0,
    [data],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    if (data != null) {
      for (const [index, q] of data.entries()) {
        config[q.question_id] = {
          label: q.question_text,
          color: COLORS[index % COLORS.length],
        };
      }
    }
    return config;
  }, [data]);

  const chartData = useMemo(
    () =>
      data?.map((q, index) => ({
        name: q.question_text,
        value: q.wrong_answers,
        total: q.total_answers,
        fill: COLORS[index % COLORS.length],
      })) ?? [],
    [data],
  );

  const hasData = data != null && data.length > 0;

  return (
    <ChartCard
      title="Najtrudniejsze pytania"
      description="Top 10 pytań z największą liczbą błędnych odpowiedzi"
      scope={scope}
      onScopeChange={setScope}
      canViewAll={canViewAll}
      isLoading={isPending}
      isRefreshing={isRefreshing}
      isEmpty={!hasData}
      placeholderClassName="min-h-[390px] w-full rounded-lg lg:min-h-[300px]"
    >
      <div className="flex flex-col items-center gap-4 lg:flex-row">
        <ChartContainer
          config={chartConfig}
          className="max-h-75 min-h-62.5 flex-1"
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="max-w-75"
                  formatter={(value, name, item) => {
                    const payload = item.payload as
                      | { total?: number }
                      | undefined;
                    return [
                      `${String(value)} / ${String(payload?.total ?? "")} · `,
                      String(name),
                    ];
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={2}
            >
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- recharts Label, not a form label */}
              <Label
                content={({ viewBox }) => {
                  if (
                    viewBox == null ||
                    !("cx" in viewBox) ||
                    !("cy" in viewBox)
                  ) {
                    return null;
                  }
                  const cx = viewBox.cx;
                  const cy = viewBox.cy;
                  return (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={cx}
                        y={cy}
                        className="fill-foreground text-2xl font-bold"
                      >
                        {totalWrong}
                      </tspan>
                      <tspan
                        x={cx}
                        y={cy + 20}
                        className="fill-muted-foreground text-xs"
                      >
                        błędnych
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-col gap-1.5 text-sm">
          {data?.map((q, index) => (
            <div key={q.question_id} className="flex items-center gap-2">
              <div
                className="size-3 shrink-0 rounded-sm"
                style={{
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
              <span className="text-muted-foreground max-w-62.5 truncate">
                {q.question_text}
              </span>
              <span className="ml-auto shrink-0 font-medium tabular-nums">
                {q.wrong_answers} / {q.total_answers}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
