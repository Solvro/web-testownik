"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuizStats } from "@/hooks/use-quiz-stats";
import type { QuizStats } from "@/types/quiz-stats";

interface StatsTableProps {
  quizId: string;
  canViewAll: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString()}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString()}:${s.toString().padStart(2, "0")}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface MetricRow {
  label: string;
  description?: string;
  getValue: (stats: QuizStats) => string;
}

const METRICS: MetricRow[] = [
  {
    label: "Liczba uruchomień",
    getValue: (s) => s.sessions_count.toString(),
  },
  {
    label: "Łączna liczba odpowiedzi",
    getValue: (s) => s.total_answers.toString(),
  },
  {
    label: "Poprawne odpowiedzi",
    getValue: (s) => s.correct_answers.toString(),
  },
  {
    label: "Błędne odpowiedzi",
    getValue: (s) => s.wrong_answers.toString(),
  },
  {
    label: "Średni czas rozwiązywania",
    getValue: (s) => formatTime(s.average_study_time_seconds),
  },
  {
    label: "Łączny czas",
    getValue: (s) => formatTime(s.total_study_time_seconds),
  },
  {
    label: "Średni wynik",
    description: "z pierwszych odpowiedzi",
    getValue: (s) => formatPercentage(s.first_answer_accuracy),
  },
];

function StatCell({ isLoading, value }: { isLoading: boolean; value: string }) {
  if (isLoading) {
    return <Skeleton className="ml-auto h-4 w-12" />;
  }
  return <span className="tabular-nums">{value}</span>;
}

function MetricLabel({ metric }: { metric: MetricRow }) {
  return (
    <div className="space-y-0.5">
      <div>{metric.label}</div>
      {metric.description == null ? null : (
        <div className="text-muted-foreground text-xs font-normal">
          {metric.description}
        </div>
      )}
    </div>
  );
}

function UniqueUsersDescription({
  isLoading,
  value,
}: {
  isLoading: boolean;
  value?: number | null;
}) {
  if (isLoading) {
    return <Skeleton className="h-5 w-56" />;
  }
  return (
    <span className="block min-h-5">
      {value == null
        ? null
        : `Liczba unikalnych użytkowników: ${value.toString()}`}
    </span>
  );
}

export function StatsTable({ quizId, canViewAll }: StatsTableProps) {
  const { data: myStats, isPending: myLoading } = useQuizStats(quizId, "me");
  const { data: allStats, isPending: allLoading } = useQuizStats(
    quizId,
    "all",
    canViewAll,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statystyki</CardTitle>
        {canViewAll ? (
          <CardDescription className="min-h-5">
            <UniqueUsersDescription
              isLoading={allLoading}
              value={allStats?.unique_users_count}
            />
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <Table wrapperClassName="rounded-md">
          <TableHeader>
            <TableRow>
              <TableHead>Metryka</TableHead>
              {canViewAll ? (
                <TableHead className="text-right">Wszyscy</TableHead>
              ) : null}
              <TableHead className="text-right">Ty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRICS.map((metric) => (
              <TableRow key={metric.label}>
                <TableCell className="font-medium">
                  <MetricLabel metric={metric} />
                </TableCell>
                {canViewAll ? (
                  <TableCell className="text-right">
                    <StatCell
                      isLoading={allLoading}
                      value={allStats == null ? "—" : metric.getValue(allStats)}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <StatCell
                    isLoading={myLoading}
                    value={myStats == null ? "—" : metric.getValue(myStats)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
