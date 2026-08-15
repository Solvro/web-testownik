"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Glass } from "@/components/canvasui/Glass";
import {
  PhoneQuizSurface,
  ProductAppChrome,
  StatsPreviewSurface,
} from "@/components/testownik-preview/product-surfaces";
import { cn } from "@/lib/utils";

import { setSatelliteHovered } from "../satellite-hover";
import { SCENE_CLASS } from "./scene-classes";

/**
 * Glass runs its own WebGL loop per instance. The magnifier is only needed once
 * the visitor is actually pointing at a device screen, so the effect stays off
 * until first contact and then remains mounted for that surface.
 */
function GlassScreen({
  children,
  targets,
}: {
  children: ReactNode;
  targets?: string;
}): React.JSX.Element {
  const [engaged, setEngaged] = useState(false);

  return (
    <div
      className="relative isolate size-full overflow-hidden"
      onPointerEnter={() => {
        setEngaged(true);
        setSatelliteHovered(true);
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
  return (
    <GlassScreen>
      <StatsPreviewSurface density="compact" />
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
