"use client";

import { useSyncExternalStore } from "react";

/**
 * `false` on the server and during hydration, so use a query to enable
 * behaviour, never to hide markup a visitor without JavaScript would get.
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
