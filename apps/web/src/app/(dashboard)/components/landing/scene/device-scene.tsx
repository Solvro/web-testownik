"use client";

import { memo, useCallback, useRef } from "react";
import type { CSSProperties } from "react";

import { HERO_PROGRESS } from "../hero-progress";
import { setSatelliteHovered } from "../satellite-hover";
import { DeviceScreenFrame } from "./device-screen-frame";
import { DeviceStack } from "./device-stack";
import { createScreenChannelName } from "./screen-frame-protocol";

const glowStyle: CSSProperties = {
  opacity: `calc(0.16 + ${HERO_PROGRESS} * 0.2)`,
  transform: `translate(-50%, -50%) scale(calc(0.86 + ${HERO_PROGRESS} * 0.16))`,
};

const DeviceSceneBackdrop = memo((): React.JSX.Element => {
  return (
    <div
      aria-hidden="true"
      style={glowStyle}
      className="bg-primary/16 absolute top-[63%] left-[56%] hidden h-[25rem] w-[min(74vw,72rem)] rounded-full blur-[90px] lg:block"
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
    // The laptop and the iPhone share their quiz over this channel. The
    // frames only mount once the stack has attached its hosts, which is
    // client-side, so a random name cannot cause a hydration mismatch.
    const channelReference = useRef<string | null>(null);
    channelReference.current ??= createScreenChannelName();
    const channel = channelReference.current;

    return (
      <DeviceStack
        coverOnly={captureLoadingCover}
        pixelRatio={capturePixelRatio}
        laptopContent={<DeviceScreenFrame device="laptop" channel={channel} />}
        tabletContent={<DeviceScreenFrame device="tablet" hoverShrinksBubble />}
        phoneContent={
          <DeviceScreenFrame
            device="phone"
            channel={channel}
            hoverShrinksBubble
          />
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
      <div className="absolute inset-0 z-2 hidden lg:block">
        <InteractiveDeviceStack
          captureLoadingCover={captureLoadingCover}
          capturePixelRatio={capturePixelRatio}
        />
      </div>
    </div>
  );
}
