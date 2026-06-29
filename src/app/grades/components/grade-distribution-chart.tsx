"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  XAxis,
  YAxis,
} from "recharts";
import type { BarShapeProps } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

import type { DistributionEntry } from "./grade-utils";
import { gradeColor, numericGradeValue } from "./grade-utils";

const distributionChartConfig = {
  percentage: { label: "Udział w grupie" },
} satisfies ChartConfig;

interface ChartRow {
  grade: string;
  percentage: number;
  fill: string;
  isYours: boolean;
}

export function GradeDistributionChart({
  distribution,
  yourValue,
  mini = false,
}: {
  distribution: DistributionEntry[];
  yourValue: number | null;
  mini?: boolean;
}) {
  if (distribution.length === 0) {
    if (mini) {
      return null;
    }
    return (
      <div
        className="border-border/70 text-muted-foreground flex items-center justify-center rounded-md border border-dashed text-xs"
        style={{ height: 92 }}
      >
        Brak rozkładu ocen w grupie
      </div>
    );
  }

  const chartData: ChartRow[] = distribution.map((item) => {
    const value = numericGradeValue(item.grade);
    const isYours =
      value != null && yourValue != null && Math.abs(value - yourValue) < 1e-6;
    return {
      grade: item.grade,
      percentage: item.percentage,
      fill: gradeColor(value).fg,
      isYours,
    };
  });

  const radius: [number, number, number, number] = mini
    ? [2, 2, 2, 2]
    : [4, 4, 2, 2];

  return (
    <ChartContainer
      config={distributionChartConfig}
      className={cn("aspect-auto w-full", mini ? "h-[30px]" : "h-[92px]")}
    >
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
      >
        {!mini && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
        <XAxis
          dataKey="grade"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          hide={mini}
          fontSize={10}
        />
        <YAxis hide domain={[0, "dataMax"]} />
        <ChartTooltip
          cursor={false}
          allowEscapeViewBox={{ x: true, y: true }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const row = payload[0].payload as ChartRow | undefined;
                return row == null ? "" : `Ocena ${row.grade}`;
              }}
              formatter={(value) => (
                <span className="text-muted-foreground flex w-full justify-between gap-3">
                  <span>Udział w grupie</span>
                  <span className="text-foreground font-medium tabular-nums">
                    {Number(value).toLocaleString("pl-PL", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </span>
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="percentage"
          isAnimationActive={!mini}
          shape={(barProps: BarShapeProps) => {
            const row = barProps.payload as ChartRow;
            return (
              <Rectangle
                x={barProps.x}
                y={barProps.y}
                width={barProps.width}
                height={barProps.height}
                radius={radius}
                fill={row.fill}
                fillOpacity={row.isYours ? 1 : 0.28}
                stroke={row.isYours ? row.fill : undefined}
                strokeWidth={row.isYours ? 1.5 : 0}
              />
            );
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}
