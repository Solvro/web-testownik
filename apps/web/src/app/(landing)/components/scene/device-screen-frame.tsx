"use client";

import { use, useEffect, useRef, useState } from "react";

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
import { ScreenProjectionContext } from "./screen-projection";

const TITLES: Record<ScreenDevice, string> = {
  laptop: "Testownik na MacBooku",
  tablet: "Statystyki Testownika na iPadzie",
  phone: "Quiz w Testowniku na iPhonie",
};

/** A screen that never reports in still lets the cover hand over after this. */
const READY_TIMEOUT_MS = 8000;

/**
 * A pointer that leaves a frame for the page reaches the page within a frame
 * or two; only one that left the window never does, and only then is the
 * Bubble told it is gone.
 */
const POINTER_GONE_MS = 120;

function pageTheme(): ScreenTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * An iframe of `/landing-screen/<device>` filling the CSS3D host. A real
 * document at the screen's native size is the only way the app's components
 * see the device rather than the visitor's monitor, and lets Floating UI
 * measure without the CSS3D perspective in the way.
 *
 * The pointer the frame reports (see `screen-frame-input.ts`) is projected
 * through the 3D screen and replayed on the page as a `pointermove`, so the
 * hero Bubble follows the cursor across the devices.
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
  const projectScreenPoint = use(ScreenProjectionContext);

  useEffect(() => {
    const frame = frameReference.current;
    if (frame === null) {
      return;
    }

    // Only a moving pointer is replayed: when the stack moves under a still
    // one, the cursor has not moved on the page.
    const client = { x: 0, y: 0 };
    let pointerInside = false;
    let leftAt = 0;
    let lastPagePointerAt = 0;
    let goneTimeout = 0;

    const replayPointer = (x: number, y: number): void => {
      if (!projectScreenPoint(device, x, y, client)) {
        return;
      }
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: client.x,
          clientY: client.y,
          pointerType: "mouse",
          isPrimary: true,
        }),
      );
    };
    const onPagePointer = (event: PointerEvent): void => {
      if (event.isTrusted) {
        lastPagePointerAt = performance.now();
      }
    };
    const onPointerGone = (): void => {
      goneTimeout = 0;
      // The page gets no pointer events while the pointer is over the frame,
      // so a real one around the time it left (either side: the page's and
      // the frame's events are not ordered) means it is on the page now.
      if (pointerInside || lastPagePointerAt > leftAt - POINTER_GONE_MS) {
        return;
      }
      if (hoverShrinksBubble) {
        setSatelliteHovered(false);
      }
      // What the Bubble reads as the pointer leaving the document.
      window.dispatchEvent(
        new PointerEvent("pointerout", { relatedTarget: null }),
      );
    };

    const onMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.contentWindow
      ) {
        return;
      }
      const message = parseScreenFrameMessage(event.data);
      switch (message?.type) {
        case "ready": {
          if (message.device === device) {
            setIsReady(true);
          }
          break;
        }
        case "pointer": {
          pointerInside = true;
          replayPointer(message.clientX, message.clientY);
          break;
        }
        case "pointerleave": {
          pointerInside = false;
          leftAt = performance.now();
          window.clearTimeout(goneTimeout);
          goneTimeout = window.setTimeout(onPointerGone, POINTER_GONE_MS);
          break;
        }
        // Theme messages go the other way; anything else is not ours.
        case "theme":
        case undefined: {
          break;
        }
      }
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("pointermove", onPagePointer, { passive: true });
    window.addEventListener("pointerover", onPagePointer, { passive: true });
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
      window.removeEventListener("pointermove", onPagePointer);
      window.removeEventListener("pointerover", onPagePointer);
      window.clearTimeout(goneTimeout);
      window.clearTimeout(timeout);
      themeObserver.disconnect();
    };
  }, [device, hoverShrinksBubble, projectScreenPoint]);

  return (
    <iframe
      ref={frameReference}
      src={source}
      title={TITLES[device]}
      tabIndex={-1}
      data-surface-ready={isReady}
      // Keeps a visitor who has jumped further down from loading the frames
      // until they come back.
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
