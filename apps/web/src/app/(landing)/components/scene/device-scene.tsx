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
  // The laptop and the iPhone share their quiz over this channel. The
  // frames only mount once the stack has attached its hosts, which is
  // client-side, so a random name cannot cause a hydration mismatch.
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

/**
 * The hero's device composition: a MacBook that opens on scroll with an iPad
 * and an iPhone that ride its lid, all three running real Testownik UI.
 */
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
       * Deliberately untransformed: a CSS transform or filter on an ancestor of
       * the CSS3D layer is applied on top of the perspective CSS3DRenderer
       * derives from the camera, which detaches every screen from its bezel.
       * All framing lives in the camera instead.
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
