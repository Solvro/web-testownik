"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StatsScope } from "@/types/quiz-stats";

interface ScopeToggleProps {
  scope: StatsScope;
  onScopeChange: (scope: StatsScope) => void;
}

export function ScopeToggle({ scope, onScopeChange }: ScopeToggleProps) {
  return (
    <Tabs
      value={scope}
      onValueChange={(v) => {
        onScopeChange(v as StatsScope);
      }}
    >
      <TabsList>
        <TabsTrigger value="me">Ty</TabsTrigger>
        <TabsTrigger value="all">Wszyscy</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
