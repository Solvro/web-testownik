"use client";

import {
  AlertCircleIcon,
  BotIcon,
  Clock3Icon,
  RefreshCwIcon,
} from "lucide-react";
import { useContext, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { AppContext } from "@/app-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIModels } from "@/hooks/use-ai-models";
import { useAIUsage } from "@/hooks/use-ai-usage";
import { getAiModelLabel } from "@/lib/ai/models";
import {
  formatAICompactCredits,
  formatAICredits,
  formatAIResetAt,
  isAIUsageWindowUnlimited,
  usageWindowPercent,
} from "@/lib/ai/usage";
import { PermissionAction } from "@/lib/auth/permissions";
import type { AIUsageWindow } from "@/types/ai-usage";
import { AI_USAGE_SCOPE_LABELS } from "@/types/ai-usage";

function UsageWindowPanel({
  label,
  window,
}: {
  label: string;
  window: AIUsageWindow;
}) {
  const isUnlimited = isAIUsageWindowUnlimited(window);
  const progress = usageWindowPercent(window);
  const limit = window.limit === null ? null : Number(window.limit);
  const remaining = window.remaining === null ? null : Number(window.remaining);

  return (
    <div className="border-border/70 space-y-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold">{label}</p>
        <span className="bg-muted rounded-md px-2 py-1 text-xs font-medium tabular-nums">
          {isUnlimited ? "Bez limitu" : `${Math.round(progress).toString()}%`}
        </span>
      </div>
      {isUnlimited ? (
        <div
          className="space-y-0.5 tabular-nums"
          title={`${formatAICredits(window.used)} wykorzystanych`}
        >
          <p className="text-xl leading-none font-semibold tracking-tight">
            {formatAICompactCredits(window.used)}
          </p>
          <p className="text-muted-foreground text-xs">wykorzystanych</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Progress value={progress} />
          <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs tabular-nums">
            <span title={`${formatAICredits(window.used)} wykorzystanych`}>
              {formatAICompactCredits(window.used)} wykorzystanych
            </span>
            <span
              title={`${formatAICredits(Math.max(0, remaining ?? 0))} z ${formatAICredits(limit ?? 0)} pozostało`}
            >
              {formatAICompactCredits(Math.max(0, remaining ?? 0))} z{" "}
              {formatAICompactCredits(limit ?? 0)} pozostało
            </span>
          </div>
        </div>
      )}
      {isUnlimited ||
      formatAIResetAt(window.resets_at, "short", Date.now()) === null ? null : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock3Icon className="size-3.5" />
          Odnowienie {formatAIResetAt(window.resets_at, "short", Date.now())}
        </p>
      )}
    </div>
  );
}

function UsageRangeTabs({
  days,
  onDaysChange,
}: {
  days: 7 | 30;
  onDaysChange: (days: 7 | 30) => void;
}) {
  return (
    <Tabs
      value={days.toString()}
      onValueChange={(value) => {
        onDaysChange(value === "7" ? 7 : 30);
      }}
    >
      <TabsList aria-label="Zakres wykresu">
        <TabsTrigger value="7">7 dni</TabsTrigger>
        <TabsTrigger value="30">30 dni</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function UsageCardSkeleton({
  days,
  onDaysChange,
}: {
  days: 7 | 30;
  onDaysChange: (days: 7 | 30) => void;
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BotIcon className="size-5" /> Wykorzystanie AI
            </CardTitle>
          </div>
          <UsageRangeTabs days={days} onDaysChange={onDaysChange} />
        </div>
      </CardHeader>
      <CardContent
        className="space-y-6"
        role="status"
        aria-label="Ładowanie wykorzystania AI"
      >
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {["Ostatnie 7 dni", "Główna tygodniowa pula wykorzystania"].map(
            (label) => (
              <div
                key={label}
                className="border-border/70 space-y-4 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-semibold">{label}</p>
                  <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium">
                    Ładowanie
                  </span>
                </div>
                <div className="space-y-2">
                  <Progress value={0} />
                  <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs tabular-nums">
                    <span>Ładowanie wykorzystania…</span>
                    <span>Ładowanie limitu…</span>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
        <section className="space-y-3">
          <div className="flex justify-between gap-3">
            <h3 className="text-sm font-semibold">Dzienne wykorzystanie</h3>
            <span className="text-muted-foreground text-xs">kredyty</span>
          </div>
          <Skeleton className="h-36 w-full rounded-lg" />
        </section>
        <div className="grid gap-6 border-t pt-5 sm:grid-cols-2">
          {[
            ["Według modelu", 2],
            ["Według funkcji", 1],
          ].map(([title, count]) => (
            <div key={String(title)} className="space-y-2">
              <p className="text-sm font-semibold">{title}</p>
              {Array.from({ length: Number(count) }, (_, index) => (
                <div key={index} className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AIUsageCard() {
  const { checkPermission } = useContext(AppContext);
  const hasAiAccess = checkPermission(PermissionAction.AI_FEATURES);
  const [days, setDays] = useState<7 | 30>(30);
  const usage = useAIUsage(hasAiAccess);
  const models = useAIModels(hasAiAccess);

  if (!hasAiAccess) {
    return null;
  }

  if (usage.isPending || models.isPending) {
    return <UsageCardSkeleton days={days} onDaysChange={setDays} />;
  }

  if (usage.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BotIcon className="size-5" /> Wykorzystanie AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Nie udało się pobrać limitów</AlertTitle>
            <AlertDescription className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void usage.refetch()}
              >
                <RefreshCwIcon /> Spróbuj ponownie
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = usage.data;
  const fallbackModel = models.data?.fallback_model;
  const knownModels = [
    ...(models.data?.models ?? []),
    ...(fallbackModel == null ? [] : [fallbackModel]),
  ];
  const dailyRows = data.daily.slice(days === 7 ? -7 : -30).map((day) => ({
    ...day,
    credits: Number(day.credits),
    label: new Date(day.date).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "short",
    }),
  }));
  const hasDailyUsage = dailyRows.some((day) => day.credits > 0);

  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BotIcon className="size-5" /> Wykorzystanie AI
            </CardTitle>
          </div>
          <UsageRangeTabs days={days} onDaysChange={setDays} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageWindowPanel label="Ostatnie 5 godzin" window={data.session} />
          <UsageWindowPanel label="Ostatnie 7 dni" window={data.weekly} />
        </div>

        <section aria-labelledby="daily-ai-usage" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="daily-ai-usage" className="text-sm font-semibold">
              Dzienne wykorzystanie
            </h3>
            <span className="text-muted-foreground text-xs">kredyty</span>
          </div>
          {hasDailyUsage ? (
            <ChartContainer
              config={{
                credits: { label: "Kredyty", color: "var(--primary)" },
              }}
              className="h-36 w-full"
              initialDimension={{ width: 700, height: 144 }}
              aria-label="Dzienne wykorzystanie kredytów AI"
            >
              <AreaChart
                data={dailyRows}
                margin={{ left: 4, right: 4, top: 8 }}
              >
                <defs>
                  <linearGradient
                    id="profile-ai-usage-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-credits)"
                      stopOpacity={0.25}
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
                  minTickGap={24}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        `${formatAICredits(Number(value))} kredytów`
                      }
                    />
                  }
                />
                <Area
                  dataKey="credits"
                  type="monotone"
                  fill="url(#profile-ai-usage-fill)"
                  stroke="var(--color-credits)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="bg-muted/40 text-muted-foreground flex h-28 items-center justify-center rounded-lg text-sm">
              Pierwsze użycie AI pojawi się tutaj.
            </div>
          )}
        </section>

        {data.by_model.length === 0 ? null : (
          <div className="grid gap-6 border-t pt-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Według modelu</p>
              {data.by_model.map((row) => (
                <div
                  key={row.model}
                  className="flex justify-between gap-3 text-xs"
                >
                  <span className="text-muted-foreground truncate">
                    {getAiModelLabel(knownModels, row.model)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatAICompactCredits(row.credits)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Według funkcji</p>
              {data.by_scope.map((row) => (
                <div
                  key={row.scope}
                  className="flex justify-between gap-3 text-xs"
                >
                  <span className="text-muted-foreground truncate">
                    {AI_USAGE_SCOPE_LABELS[row.scope ?? ""] ?? row.scope}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatAICompactCredits(row.credits)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
