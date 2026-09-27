"use client";

import type { StatsScope } from "@testownik/core/quiz/stats";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
