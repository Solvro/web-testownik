"use client";

import {
  Card,
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
        <div className="bg-background/90 text-muted-foreground ring-border absolute top-2 right-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs shadow-sm ring-1 backdrop-blur-sm">
          <Spinner className="size-3" />
          <span>Ładuję</span>
        </div>
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
  children,
}: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description == null ? null : (
            <CardDescription>{description}</CardDescription>
          )}
        </div>
        {canViewAll ? (
          <ScopeToggle scope={scope} onScopeChange={onScopeChange} />
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
