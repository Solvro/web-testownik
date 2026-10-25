"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ChartMode = "timeline" | "sessions";

interface ChartModeToggleProps {
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
  canUseSessions: boolean;
}

export function ChartModeToggle({
  mode,
  onModeChange,
  canUseSessions,
}: ChartModeToggleProps) {
  return (
    <Tabs
      value={mode}
      onValueChange={(v) => {
        onModeChange(v as ChartMode);
      }}
    >
      <TabsList>
        <TabsTrigger value="timeline">Dni</TabsTrigger>
        <TabsTrigger value="sessions" disabled={!canUseSessions}>
          Sesje
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
