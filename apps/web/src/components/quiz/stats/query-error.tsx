"use client";

import { Button } from "@/components/ui/button";

export interface StatsQueryErrorState {
  hasCachedData: boolean;
  isFetching: boolean;
  onRetry: () => void;
}

export function StatsQueryError({
  hasCachedData,
  isFetching,
  onRetry,
}: StatsQueryErrorState) {
  return (
    <div role={hasCachedData ? "status" : "alert"} className="space-y-2">
      <p>
        {hasCachedData
          ? "Nie udało się odświeżyć statystyk. Wyświetlamy ostatnio wczytane dane."
          : "Nie udało się wczytać statystyk."}
      </p>
      <Button variant="outline" disabled={isFetching} onClick={onRetry}>
        {isFetching ? "Ładowanie…" : "Spróbuj ponownie"}
      </Button>
    </div>
  );
}
