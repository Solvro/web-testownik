"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";

import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { invalidateAIUsage } from "@/hooks/use-ai-usage";
import { getUserService } from "@/services";
import type { AIAdminStats } from "@/types/ai-admin";
import { AI_USAGE_SCOPE_LABELS } from "@/types/ai-usage";

import { aiAdminKeys, formatNumber, formatRequestCount } from "./config";
import { AdminLoading, QueryError, SectionHeading } from "./shared";

export function StatisticsPanel({ canManage }: { canManage: boolean }) {
  const stats = useQuery({
    queryKey: aiAdminKeys.stats,
    queryFn: async () => getUserService().getAIAdminStats(),
    staleTime: 30_000,
  });

  if (stats.isPending) {
    return (
      <div className="space-y-4">
        <SectionHeading
          title="Przegląd wykorzystania"
          description="Ostatnie 30 dni."
        />
        <AdminLoading label="Ładowanie statystyk" />
      </div>
    );
  }
  if (stats.isError) {
    return (
      <div className="space-y-4">
        <SectionHeading
          title="Przegląd wykorzystania"
          description="Ostatnie 30 dni."
        />
        <QueryError
          title="Nie udało się pobrać statystyk"
          onRetry={() => void stats.refetch()}
        />
      </div>
    );
  }

  const data = stats.data;
  const totalTokens =
    Number(data.totals.input_tokens ?? 0) +
    Number(data.totals.output_tokens ?? 0) +
    Number(data.totals.cache_read_tokens ?? 0);
  const events = Number(data.totals.events ?? 0);
  const problemEvents =
    Number(data.totals.aborted ?? 0) + Number(data.totals.errors ?? 0);
  const successRate =
    events === 0
      ? null
      : Math.max(0, ((events - problemEvents) / events) * 100);

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Przegląd wykorzystania"
        description="Ostatnie 30 dni."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!data.limits_enabled && (
              <Badge variant="destructive">Limity wyłączone</Badge>
            )}
            {canManage ? <ResetAllLimitsButton /> : null}
          </div>
        }
      />
      <Card className="py-0">
        <CardContent className="grid p-0 sm:grid-cols-3">
          <Metric
            label="Zużyte kredyty"
            value={formatNumber(data.totals.credits)}
            detail={formatRequestCount(events)}
          />
          <Metric
            label="Przetworzone tokeny"
            value={formatNumber(totalTokens)}
            detail={`${formatNumber(data.totals.cache_read_tokens)} z cache`}
          />
          <Metric
            label="Udane zakończenia"
            value={
              successRate === null ? "—" : `${formatNumber(successRate, 1)}%`
            }
            detail={
              successRate === null
                ? "Brak danych"
                : `${formatNumber(problemEvents)} przerwanych lub błędnych`
            }
          />
        </CardContent>
      </Card>
      <DailyUsageChart rows={data.daily} />
      <div className="grid gap-5 xl:grid-cols-2">
        <DistributionPanel
          title="Modele"
          description="Udział modeli w całkowitym zużyciu kredytów."
          rows={data.by_model.map((row) => ({
            id: row.model,
            label: row.label,
            icon: (
              <AiModelProviderIcon
                provider={row.provider}
                className="size-4 shrink-0"
              />
            ),
            value: Number(row.credits),
            detail: formatRequestCount(row.events),
          }))}
        />
        <DistributionPanel
          title="Funkcje"
          description="Które funkcje wykorzystują budżet AI."
          rows={data.by_scope.map((row) => ({
            id: row.scope,
            label: AI_USAGE_SCOPE_LABELS[row.scope] ?? row.scope,
            value: Number(row.credits),
            detail: formatRequestCount(row.events),
          }))}
        />
      </div>
      <TopUsers rows={data.top_users} />
    </div>
  );
}

function ResetAllLimitsButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const reset = useMutation({
    mutationFn: async () => getUserService().resetAIAdminLimits(),
    onSuccess: async () => {
      setOpen(false);
      await Promise.all([
        invalidateAIUsage(queryClient),
        queryClient.invalidateQueries({ queryKey: aiAdminKeys.usersRoot }),
      ]);
      toast.success("Limity wszystkich użytkowników zostały zresetowane");
    },
    onError: () => {
      toast.error("Nie udało się zresetować limitów");
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm" disabled={reset.isPending}>
            <RotateCcwIcon /> Resetuj limity
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Zresetować limity wszystkich użytkowników?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Bieżące wykorzystanie w obu oknach zostanie wyzerowane. Historia
            zdarzeń i statystyki pozostaną bez zmian.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>
            Anuluj
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={reset.isPending}
            onClick={() => {
              reset.mutate();
            }}
          >
            {reset.isPending ? "Resetowanie…" : "Resetuj wszystkim"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border/70 border-b p-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
    </div>
  );
}

function DailyUsageChart({ rows }: { rows: AIAdminStats["daily"] }) {
  const chartRows = rows.map((row) => ({
    ...row,
    credits: Number(row.credits),
    label: new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "short",
    }).format(new Date(row.day)),
  }));
  const hasUsage = rows.some(
    (row) => Number(row.credits) > 0 || row.events > 0,
  );
  return (
    <Card size="sm">
      <CardContent>
        <h3 className="font-semibold">Ruch w czasie</h3>
        {hasUsage ? (
          <ChartContainer
            config={{ credits: { label: "Kredyty", color: "var(--primary)" } }}
            className="mt-4 h-56 w-full"
            initialDimension={{ width: 900, height: 224 }}
            aria-label="Dzienne wykorzystanie AI"
          >
            <AreaChart
              accessibilityLayer
              data={chartRows}
              margin={{ left: 4, right: 4, top: 8 }}
            >
              <defs>
                <linearGradient id="ai-usage-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-credits)"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-credits)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={String}
                    formatter={(value) => (
                      <span className="font-medium tabular-nums">
                        {formatNumber(Number(value))} kredytów
                      </span>
                    )}
                  />
                }
              />
              <Area
                dataKey="credits"
                type="monotone"
                fill="url(#ai-usage-fill)"
                stroke="var(--color-credits)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="bg-muted/40 text-muted-foreground mt-5 flex h-44 items-center justify-center rounded-lg text-sm">
            Brak zarejestrowanego użycia w tym okresie.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DistributionPanel({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: {
    id: string;
    label: string;
    icon?: ReactNode;
    value: number;
    detail: string;
  }[];
}) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  const hasValues = rows.some((row) => row.value > 0);
  return (
    <Card size="sm">
      <CardContent>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        <div className="mt-5 space-y-4">
          {hasValues ? (
            rows.slice(0, 8).map((row) => (
              <div key={row.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    {row.icon}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatNumber(row.value)} · {row.detail}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{
                      width:
                        row.value <= 0
                          ? "0%"
                          : `${Math.max(2, (row.value / maximum) * 100).toString()}%`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Brak danych do porównania.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TopUsers({ rows }: { rows: AIAdminStats["top_users"] }) {
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <div className="border-b px-5 py-4">
          <h3 className="font-semibold">Najaktywniejsi użytkownicy</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Konta z największym zużyciem kredytów w tym okresie.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">
            Brak aktywnych użytkowników.
          </p>
        ) : (
          <div className="divide-y">
            {rows.slice(0, 10).map((row, index) => (
              <div
                key={row.user_id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-sm"
              >
                <span className="text-muted-foreground text-xs tabular-nums">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <span className="truncate">
                  {row.user__email ?? row.user_id}
                </span>
                <span className="font-medium tabular-nums">
                  {formatNumber(row.credits)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
