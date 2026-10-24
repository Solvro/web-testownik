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

/**
 * A screen that never reports in (a failed request, a crashed frame) still
 * lets the scene take over from the loading cover after this long.
 */
const READY_TIMEOUT_MS = 8000;

/**
 * A pointer that leaves a frame for the page reaches the page as a real event
 * within a frame or two; one that left the window entirely never does, and
 * only then is the Bubble told the pointer is gone. Entering the frame is
 * itself a real `pointerover` on the iframe, so a pointer that only crossed
 * the frame in less than this is not dismissed either.
 */
const POINTER_GONE_MS = 120;

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
 *
 * The frame hands back the pointer the page would otherwise lose to it (see
 * `screen-frame-input.ts`): it is projected through the 3D screen and
 * replayed on the page as a `pointermove`, so the hero Bubble follows the
 * cursor across the devices. Wheel input is the browser's: a gesture stays
 * with a screen's own scroller and chains to the page past it, as over any
 * iframe.
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

    // --- Pointer -------------------------------------------------------
    // Only a moving pointer is replayed. When the stack moves under a still
    // one, the cursor has not moved on the page and the Bubble keeps its
    // client point; the frame reports the new point under it if it changes.
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

    // --- Theme ---------------------------------------------------------
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
      // A preview, not part of the page's keyboard path: Tab skips the frame.
      tabIndex={-1}
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
