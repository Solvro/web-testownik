"use client";

import { useSyncExternalStore } from "react";

const STANDALONE_QUERY =
  "(display-mode: standalone), (display-mode: window-controls-overlay)";

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(STANDALONE_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => {
    mediaQuery.removeEventListener("change", callback);
  };
}

function getSnapshot() {
  return window.matchMedia(STANDALONE_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useIsStandalone() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
