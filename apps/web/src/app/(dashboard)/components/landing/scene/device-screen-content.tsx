"use client";

import { Suspense, lazy, useCallback, useState } from "react";
import type { ReactNode } from "react";

import { Glass } from "@/components/canvasui/Glass";
import {
  PhoneQuizSurface,
  ProductAppChrome,
} from "@/components/testownik-preview/product-surfaces";
import { cn } from "@/lib/utils";

import { setSatelliteHovered } from "../satellite-hover";
import { SCENE_CLASS } from "./scene-classes";

const TabletLiveCharts = lazy(async () => {
  const loaded = await import("./tablet-live-charts");
  return { default: loaded.TabletLiveCharts };
});

/**
 * Glass runs its own WebGL loop per instance. The magnifier is only needed once
 * the visitor is actually pointing at a device screen, so the effect stays off
 * until first contact and then remains mounted for that surface.
 */
function GlassScreen({
  children,
  targets,
  onFirstEngage,
}: {
  children: ReactNode;
  targets?: string;
  onFirstEngage?: () => void;
}): React.JSX.Element {
  const [engaged, setEngaged] = useState(false);

  return (
    <div
      className="relative isolate size-full overflow-hidden"
      onPointerEnter={() => {
        setEngaged(true);
        setSatelliteHovered(true);
        if (!engaged) {
          onFirstEngage?.();
        }
      }}
      onPointerLeave={() => {
        setSatelliteHovered(false);
      }}
    >
      {engaged ? (
        <Glass
          className={cn("size-full", SCENE_CLASS.deviceGlass)}
          size={60}
          targets={targets}
        >
          {children}
        </Glass>
      ) : (
        children
      )}
    </div>
  );
}

export interface DeviceQuizControls {
  selectedAnswers: string[];
  onSelectedAnswersChange: (answers: string[]) => void;
  questionChecked: boolean;
  onQuestionCheckedChange: (checked: boolean) => void;
}

export function DeviceLaptopScreen({
  selectedAnswers,
  onSelectedAnswersChange,
  questionChecked,
  onQuestionCheckedChange,
}: DeviceQuizControls): React.JSX.Element {
  return (
    <ProductAppChrome
      selectedAnswers={selectedAnswers}
      onSelectedAnswersChange={onSelectedAnswersChange}
      questionChecked={questionChecked}
      onQuestionCheckedChange={onQuestionCheckedChange}
    />
  );
}

export function DeviceTabletScreen(): React.JSX.Element {
  const [showCharts, setShowCharts] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const revealCharts = useCallback(() => {
    setChartsReady(true);
  }, []);

  return (
    <GlassScreen
      onFirstEngage={() => {
        setShowCharts(true);
      }}
    >
      <div className="relative size-full">
        {/* Captured from the real seeded charts; refresh when their preview changes. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-[url(/models/testownik-tablet-stats-preview-light.webp)] bg-size-[100%_100%] transition-opacity duration-150 dark:bg-[url(/models/testownik-tablet-stats-preview-dark.webp)]",
            chartsReady ? "opacity-0" : "opacity-100",
          )}
        />
        {showCharts ? (
          <Suspense fallback={null}>
            <TabletLiveCharts visible={chartsReady} onReady={revealCharts} />
          </Suspense>
        ) : null}
      </div>
    </GlassScreen>
  );
}

export function DevicePhoneScreen({
  selectedAnswers,
  onSelectedAnswersChange,
  questionChecked,
  onQuestionCheckedChange,
  withGlass = true,
}: DeviceQuizControls & {
  withGlass?: boolean;
}): React.JSX.Element {
  const surface = (
    <PhoneQuizSurface
      selectedAnswers={selectedAnswers}
      onSelectedAnswersChange={onSelectedAnswersChange}
      questionChecked={questionChecked}
      onQuestionCheckedChange={onQuestionCheckedChange}
    />
  );

  if (!withGlass) {
    return surface;
  }

  return (
    <GlassScreen targets="button, [data-slot=card-title]">
      {surface}
    </GlassScreen>
  );
}
