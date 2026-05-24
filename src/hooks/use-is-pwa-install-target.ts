"use client";

import { useSyncExternalStore } from "react";

import { isMobileUserAgent } from "@/lib/pwa/device";

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

// Per unicorn/consistent-function-scoping, move both subscribeMobileUa and its returned function to the outer scope
const noopUnsubscribe = () => {
  // No-op unsubscribe function required by subscribeMobileUa
};

const subscribeMobileUa = (_callback: () => void) => {
  // User agent string does not change at runtime
  return noopUnsubscribe;
};

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
    subscribeMobileUa,
    isMobileUserAgent,
    () => false,
  );

  return isNarrowViewport || isMobileUa;
}
