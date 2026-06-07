"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Children, Component } from "react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsCardErrorBoundaryProps {
  resetKeys?: readonly unknown[];
  children: ReactNode;
}

interface StatsCardErrorBoundaryState {
  hasError: boolean;
}

function areResetKeysEqual(
  previousResetKeys: readonly unknown[],
  resetKeys: readonly unknown[],
): boolean {
  return (
    previousResetKeys.length === resetKeys.length &&
    previousResetKeys.every((key, index) => Object.is(key, resetKeys[index]))
  );
}

export class StatsCardErrorBoundary extends Component<
  StatsCardErrorBoundaryProps,
  StatsCardErrorBoundaryState
> {
  state: StatsCardErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): StatsCardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(
    previousProps: Readonly<StatsCardErrorBoundaryProps>,
  ): void {
    const previousResetKeys = previousProps.resetKeys ?? [];
    const resetKeys = this.props.resetKeys ?? [];

    if (
      this.state.hasError &&
      !areResetKeysEqual(previousResetKeys, resetKeys)
    ) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="text-destructive size-5" />
              Sekcja statystyk
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Nie udało się wyświetlić tej sekcji statystyk.
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

interface StatsCardErrorBoundaryGroupProps {
  resetKeys?: readonly unknown[];
  children: ReactNode;
}

export function StatsCardErrorBoundaryGroup({
  resetKeys,
  children,
}: StatsCardErrorBoundaryGroupProps): ReactNode {
  return Children.map(children, (child) => {
    if (child == null) {
      return child;
    }

    return (
      <StatsCardErrorBoundary resetKeys={resetKeys}>
        {child}
      </StatsCardErrorBoundary>
    );
  });
}
