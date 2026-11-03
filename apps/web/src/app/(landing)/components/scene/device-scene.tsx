"use client";

import { useRef } from "react";

import { setSatelliteHovered } from "../satellite-hover";
import { DeviceSceneBackdrop } from "./device-scene-backdrop";
import { DeviceScreenFrame } from "./device-screen-frame";
import { DeviceStack } from "./device-stack";
import { createScreenChannelName } from "./screen-frame-protocol";

function InteractiveDeviceStack({
  captureLoadingCover,
  capturePixelRatio,
  onUnavailable,
  onRestored,
  onReady,
}: {
  captureLoadingCover?: boolean;
  capturePixelRatio?: number;
  onUnavailable?: () => void;
  onRestored?: () => void;
  onReady?: () => void;
}): React.JSX.Element {
  // The frames mount client-side only, so a random name cannot cause a
  // hydration mismatch.
  const channelReference = useRef<string | null>(null);
  channelReference.current ??= createScreenChannelName();
  const channel = channelReference.current;

  return (
    <DeviceStack
      onUnavailable={onUnavailable}
      onRestored={onRestored}
      onReady={onReady}
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
}

export function DeviceScene({
  captureLoadingCover = false,
  captureMode = false,
  isStatic = false,
  capturePixelRatio,
  onUnavailable,
  onRestored,
  onReady,
}: {
  captureLoadingCover?: boolean;
  captureMode?: boolean;
  isStatic?: boolean;
  capturePixelRatio?: number;
  onUnavailable?: () => void;
  onRestored?: () => void;
  onReady?: () => void;
}): React.JSX.Element {
  return (
    <div
      aria-label="MacBook Pro otwierający Testownik oraz statystyki na iPadzie i quiz na iPhonie"
      className="pointer-events-none absolute inset-0 isolate"
      onPointerLeave={() => {
        setSatelliteHovered(false);
      }}
    >
      {captureMode ? null : <DeviceSceneBackdrop isStatic={isStatic} />}

      {/*
       * Keep untransformed: a transform or filter on an ancestor of the CSS3D
       * layer applies on top of CSS3DRenderer's perspective and detaches every
       * screen from its bezel.
       */}
      <div className="absolute inset-0 z-2 hidden lg:block">
        <InteractiveDeviceStack
          onUnavailable={onUnavailable}
          onRestored={onRestored}
          onReady={onReady}
          captureLoadingCover={captureLoadingCover}
          capturePixelRatio={capturePixelRatio}
        />
      </div>
    </div>
  );
}
