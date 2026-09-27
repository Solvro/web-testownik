"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to a media query. Server rendering and the hydration pass both see
 * `false`, so a query is only ever allowed to enable behaviour, never to hide
 * markup that a JavaScript-less visitor would otherwise get.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
