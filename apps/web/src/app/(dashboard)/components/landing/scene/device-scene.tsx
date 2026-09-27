"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { HERO_PROGRESS } from "../hero-progress";
import { wordmarkDark, wordmarkLight } from "../logos";
import { setSatelliteHovered } from "../satellite-hover";
import type { DeviceQuizControls } from "./device-screen-content";
import { DeviceStack } from "./device-stack";
import { SCENE_CLASS } from "./scene-classes";

type DeviceScreenModule = typeof import("./device-screen-content");

const glowStyle: CSSProperties = {
  opacity: `calc(0.16 + ${HERO_PROGRESS} * 0.2)`,
  transform: `translate(-50%, -50%) scale(calc(0.86 + ${HERO_PROGRESS} * 0.16))`,
};

/** Appears above the open laptop, once the lid is most of the way up. */
const openLogoStyle: CSSProperties = {
  opacity: `clamp(0, calc((${HERO_PROGRESS} - 0.6) * 6), 1)`,
  transform: `translate(-50%, calc((1 - ${HERO_PROGRESS}) * 1.5rem)) scale(calc(0.96 + ${HERO_PROGRESS} * 0.04))`,
};

const mobilePhoneStyle: CSSProperties = {
  transform: `translate(-50%, calc(-50% - ${HERO_PROGRESS} * 3rem)) rotate(calc(-2deg + ${HERO_PROGRESS} * 3deg))`,
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
    <>
      <div
        aria-hidden="true"
        style={glowStyle}
        className="bg-primary/16 absolute top-[63%] left-[56%] hidden h-[25rem] w-[min(74vw,72rem)] rounded-full blur-[90px] sm:block"
      />
      <div
        aria-hidden="true"
        style={openLogoStyle}
        className="absolute top-[clamp(5.5rem,10vh,8rem)] left-1/2 z-6 hidden w-[clamp(13rem,17vw,20rem)] transition-opacity duration-[120ms] sm:block"
      >
        <Image
          src={wordmarkLight}
          alt=""
          className="block h-auto w-full dark:hidden"
        />
        <Image
          src={wordmarkDark}
          alt=""
          className="hidden h-auto w-full dark:block"
        />
      </div>
    </>
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

const MobilePhonePreview = memo((): React.JSX.Element => {
  const screens = useDeviceScreenModule(true);
  const quiz = useQuizPreviewState();

  return (
    <div
      style={mobilePhoneStyle}
      className={cn(
        SCENE_CLASS.mobilePhone,
        "pointer-events-auto absolute top-1/2 left-1/2 z-7 block h-[868px] w-[428px] sm:hidden",
      )}
    >
      <div className="device device-iphone-14-pro">
        <div className="device-frame">
          <div
            className={cn(
              "device-screen bg-background overflow-hidden",
              "[&>*]:size-full",
            )}
          >
            {screens === null ? null : <screens.DevicePhoneScreen {...quiz} />}
          </div>
        </div>
        <div className="device-stripe" />
        <div className="device-header" />
        <div className="device-sensors" />
        <div className="device-btns" />
        <div className="device-power" />
        <div className="device-home" />
      </div>
    </div>
  );
});
MobilePhonePreview.displayName = "MobilePhonePreview";

/**
 * The hero's device composition: a MacBook that opens on scroll with an iPad
 * and an iPhone that ride its lid, all three running real Testownik UI.
 *
 * Phones get none of it. Below 681px the 3D stack never boots (see
 * `DeviceStack`) and a single floating iPhone stands in for the whole scene.
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

      {captureMode ? null : <MobilePhonePreview />}
    </div>
  );
}
