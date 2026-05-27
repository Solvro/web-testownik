"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { StatsScope } from "@/types/quiz-stats";

import { ScopeToggle } from "./scope-toggle";

const DEFAULT_CHART_PLACEHOLDER_CLASS =
  "aspect-video min-h-[250px] w-full rounded-lg";

function ChartCardContent({
  isLoading,
  isRefreshing,
  isEmpty,
  placeholderClassName,
  children,
}: {
  isLoading: boolean;
  isRefreshing: boolean;
  isEmpty: boolean;
  placeholderClassName: string;
  children: React.ReactNode;
}): React.JSX.Element | React.ReactNode {
  if (isLoading) {
    return <Skeleton className={placeholderClassName} />;
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "transition-opacity duration-200",
          isRefreshing && "opacity-70",
        )}
      >
        {isEmpty ? (
          <div
            className={cn(
              "text-muted-foreground flex flex-col items-center justify-center gap-1",
              placeholderClassName,
            )}
          >
            <p className="text-lg font-medium">Brak danych</p>
            <p className="text-sm">
              Brak sesji w wybranym przedziale czasowym.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
      {isRefreshing ? (
        <Badge variant="outline" className="absolute top-2 right-2">
          <Spinner className="size-3" />
          <span>Ładuję</span>
        </Badge>
      ) : null}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  description?: string;
  scope: StatsScope;
  onScopeChange: (scope: StatsScope) => void;
  canViewAll: boolean;
  isLoading: boolean;
  isRefreshing?: boolean;
  isEmpty: boolean;
  placeholderClassName?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  description,
  scope,
  onScopeChange,
  canViewAll,
  isLoading,
  isRefreshing = false,
  isEmpty,
  placeholderClassName = DEFAULT_CHART_PLACEHOLDER_CLASS,
  toolbar,
  children,
}: ChartCardProps) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="">
          <CardTitle>{title}</CardTitle>
          {description == null ? null : (
            <CardDescription>{description}</CardDescription>
          )}
        </div>
        {toolbar != null || canViewAll ? (
          <CardAction className="flex flex-col-reverse flex-wrap items-end justify-end gap-2 @sm/card:flex-row @sm/card:items-center">
            {toolbar}
            {canViewAll ? (
              <ScopeToggle scope={scope} onScopeChange={onScopeChange} />
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ChartCardContent
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          isEmpty={isEmpty}
          placeholderClassName={placeholderClassName}
        >
          {children}
        </ChartCardContent>
      </CardContent>
    </Card>
  );
}
