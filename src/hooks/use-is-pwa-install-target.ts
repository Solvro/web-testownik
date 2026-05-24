"use client";

import { useSyncExternalStore } from "react";

import { isMobileUserAgent } from "@/lib/pwa/device";

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

function subscribeViewport(callback: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => {
    mediaQuery.removeEventListener("change", callback);
  };
}

function getViewportSnapshot() {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

export function useIsPwaInstallTarget() {
  const isNarrowViewport = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    () => false,
  );
  const isMobileUa = useSyncExternalStore(
    () => () => {},
    isMobileUserAgent,
    () => false,
  );

  return isNarrowViewport || isMobileUa;
}
