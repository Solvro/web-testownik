"use client";

import { useEffect, useRef, useState } from "react";

import { setSatelliteHovered } from "../satellite-hover";
import {
  SCREEN_FRAME_SOURCE,
  parseScreenFrameMessage,
  screenFrameUrl,
} from "./screen-frame-protocol";
import type {
  ScreenDevice,
  ScreenTheme,
  ScreenThemeMessage,
} from "./screen-frame-protocol";

const TITLES: Record<ScreenDevice, string> = {
  laptop: "Testownik na MacBooku",
  tablet: "Statystyki Testownika na iPadzie",
  phone: "Quiz w Testowniku na iPhonie",
};

/**
 * A screen that never reports in (a failed request, a crashed frame) still
 * lets the scene take over from the loading cover after this long.
 */
const READY_TIMEOUT_MS = 8000;

function pageTheme(): ScreenTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * One live device screen of the desktop hero: an iframe of
 * `/landing-screen/<device>` filling the CSS3D host, as in three.js's CSS3D
 * examples. A real document at the screen's native size is the only way the
 * app's components inside see the device rather than the visitor's monitor,
 * and Floating UI measures it without the CSS3D perspective in the way.
 *
 * `data-surface-ready` flips once the frame has painted; `createDeviceStack`
 * waits for it on all three screens before the cover fades out. The page's
 * theme is passed in the URL once and posted to the frame on every change.
 * Pointer events and `inert` come from the host, which the scene toggles
 * while a screen is hidden or the lid is closed.
 */
export function DeviceScreenFrame({
  device,
  channel,
  hoverShrinksBubble = false,
}: {
  device: ScreenDevice;
  channel?: string;
  /** Satellites shrink the hero Bubble while hovered. */
  hoverShrinksBubble?: boolean;
}): React.JSX.Element {
  const frameReference = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  // Fixed at mount: changing `src` would reload the screen.
  const sourceReference = useRef<string | null>(null);
  sourceReference.current ??= screenFrameUrl({
    device,
    theme: pageTheme(),
    channel,
  });
  const source = sourceReference.current;

  useEffect(() => {
    const frame = frameReference.current;
    if (frame === null) {
      return;
    }

    const onMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.contentWindow
      ) {
        return;
      }
      const message = parseScreenFrameMessage(event.data);
      if (message?.type === "ready" && message.device === device) {
        setIsReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    const timeout = window.setTimeout(() => {
      setIsReady(true);
    }, READY_TIMEOUT_MS);

    let theme = pageTheme();
    const themeObserver = new MutationObserver(() => {
      const next = pageTheme();
      if (next === theme) {
        return;
      }
      theme = next;
      frame.contentWindow?.postMessage(
        {
          source: SCREEN_FRAME_SOURCE,
          type: "theme",
          theme,
        } satisfies ScreenThemeMessage,
        window.location.origin,
      );
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      themeObserver.disconnect();
    };
  }, [device]);

  return (
    <iframe
      ref={frameReference}
      src={source}
      title={TITLES[device]}
      data-surface-ready={isReady}
      // The stack mounts the screens only once the hero is near the
      // viewport and the model has loaded, so `lazy` defers nothing on
      // arrival; it does keep a visitor who has jumped further down from
      // loading them until they come back. (`fetchpriority` is not an
      // iframe attribute.)
      loading="lazy"
      className="bg-background block size-full border-0"
      onPointerEnter={
        hoverShrinksBubble
          ? () => {
              setSatelliteHovered(true);
            }
          : undefined
      }
      onPointerLeave={
        hoverShrinksBubble
          ? () => {
              setSatelliteHovered(false);
            }
          : undefined
      }
    />
  );
}
