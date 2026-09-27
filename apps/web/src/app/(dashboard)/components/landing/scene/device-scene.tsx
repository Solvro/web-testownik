"use client";

import { memo, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { HERO_PROGRESS } from "../hero-progress";
import { setSatelliteHovered } from "../satellite-hover";
import type { DeviceQuizControls } from "./device-screen-content";
import { DeviceStack } from "./device-stack";

type DeviceScreenModule = typeof import("./device-screen-content");

const glowStyle: CSSProperties = {
  opacity: `calc(0.16 + ${HERO_PROGRESS} * 0.2)`,
  transform: `translate(-50%, -50%) scale(calc(0.86 + ${HERO_PROGRESS} * 0.16))`,
};

function useDeviceScreenModule(enabled: boolean): DeviceScreenModule | null {
  const [module, setModule] = useState<DeviceScreenModule | null>(null);

  useEffect(() => {
    if (!enabled || module !== null) {
      return;
    }

    let cancelled = false;
    void import("./device-screen-content").then((loaded) => {
      if (!cancelled) {
        setModule(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, module]);

  return module;
}

function useQuizPreviewState(): DeviceQuizControls {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(["a-4"]);
  const [questionChecked, setQuestionChecked] = useState(false);

  return {
    selectedAnswers,
    onSelectedAnswersChange: setSelectedAnswers,
    questionChecked,
    onQuestionCheckedChange: setQuestionChecked,
  };
}

const DeviceSceneBackdrop = memo((): React.JSX.Element => {
  return (
    <div
      aria-hidden="true"
      style={glowStyle}
      className="bg-primary/16 absolute top-[63%] left-[56%] hidden h-[25rem] w-[min(74vw,72rem)] rounded-full blur-[90px] sm:block"
    />
  );
});
DeviceSceneBackdrop.displayName = "DeviceSceneBackdrop";

const InteractiveDeviceStack = memo(
  ({
    captureLoadingCover,
    capturePixelRatio,
  }: {
    captureLoadingCover?: boolean;
    capturePixelRatio?: number;
  }): React.JSX.Element => {
    const [hostsAttached, setHostsAttached] = useState(false);
    const screens = useDeviceScreenModule(hostsAttached);
    const quiz = useQuizPreviewState();

    const handleHostsAttached = useCallback((): void => {
      setHostsAttached(true);
    }, []);

    return (
      <DeviceStack
        coverOnly={captureLoadingCover}
        pixelRatio={capturePixelRatio}
        onHostsAttached={handleHostsAttached}
        laptopContent={
          screens === null ? null : <screens.DeviceLaptopScreen {...quiz} />
        }
        tabletContent={screens === null ? null : <screens.DeviceTabletScreen />}
        phoneContent={
          screens === null ? null : <screens.DevicePhoneScreen {...quiz} />
        }
      />
    );
  },
);
InteractiveDeviceStack.displayName = "InteractiveDeviceStack";

/**
 * The hero's device composition: a MacBook that opens on scroll with an iPad
 * and an iPhone that ride its lid, all three running real Testownik UI.
 */
export function DeviceScene({
  captureLoadingCover = false,
  captureMode = false,
  capturePixelRatio,
}: {
  captureLoadingCover?: boolean;
  captureMode?: boolean;
  capturePixelRatio?: number;
}): React.JSX.Element {
  const resetSatelliteHover = useCallback((): void => {
    setSatelliteHovered(false);
  }, []);

  return (
    <div
      aria-label="MacBook Pro otwierający Testownik oraz statystyki na iPadzie i quiz na iPhonie"
      className="pointer-events-none absolute inset-0 isolate"
      onPointerLeave={resetSatelliteHover}
    >
      {captureMode ? null : <DeviceSceneBackdrop />}

      {/*
       * Deliberately untransformed: a CSS transform or filter on an ancestor of
       * the CSS3D layer is applied on top of the perspective CSS3DRenderer
       * derives from the camera, which detaches every screen from its bezel.
       * All framing lives in the camera instead.
       */}
      <div className="absolute inset-0 z-2 hidden sm:block">
        <InteractiveDeviceStack
          captureLoadingCover={captureLoadingCover}
          capturePixelRatio={capturePixelRatio}
        />
      </div>
    </div>
  );
}
