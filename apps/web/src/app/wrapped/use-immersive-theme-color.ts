"use client";

import { useEffect, useRef } from "react";

/** Keep in step with the fullscreen overlay breakpoint in wrapped.css. */
const IMMERSIVE_QUERY = "(max-width: 640px)";

/** Let the card expand before Safari starts sampling the body tint. */
const EDGE_EXPAND_MS = 150;

const IOS_SAFARI_EXCLUDE = /(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/;

function isIosSafari(): boolean {
  const { maxTouchPoints, userAgent } = navigator;
  const isIos =
    /iP(hone|ad|od)/.test(userAgent) ||
    (userAgent.includes("Macintosh") && maxTouchPoints > 1);

  return (
    isIos &&
    userAgent.includes("Safari") &&
    userAgent.includes("Version/") &&
    !IOS_SAFARI_EXCLUDE.test(userAgent)
  );
}

/**
 * Safari caches tint samples from fixed overlays; the body background updates live.
 * During immersive slides, mirror the active colour there so browser chrome follows.
 */
export function useImmersiveThemeColor(color: string | null): void {
  // Delay only the first tint after entering immersive mode.
  const applied = useRef(false);

  useEffect(() => {
    if (color === null || !isIosSafari()) {
      applied.current = false;
      return;
    }
    const media = window.matchMedia(IMMERSIVE_QUERY);
    const root = document.documentElement;
    const { body } = document;

    const previous = {
      root: root.style.backgroundColor,
      body: body.style.backgroundColor,
    };

    const restore = () => {
      root.style.backgroundColor = previous.root;
      body.style.backgroundColor = previous.body;
      body.classList.remove("wrapped-immersive-body");
    };

    const sync = () => {
      if (media.matches) {
        applied.current = true;
        body.classList.add("wrapped-immersive-body");
        root.style.backgroundColor = color;
        body.style.backgroundColor = color;
      } else {
        applied.current = false;
        restore();
      }
    };

    const timeout = applied.current ? null : setTimeout(sync, EDGE_EXPAND_MS);
    if (timeout === null) {
      sync();
    }
    media.addEventListener("change", sync);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      media.removeEventListener("change", sync);
      restore();
    };
  }, [color]);
}
