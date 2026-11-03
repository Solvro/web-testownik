"use client";

import { BREAKPOINT, DESKTOP_STAGE_QUERY } from "../breakpoints";
import { useMediaQuery } from "./use-media-query";

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True only where a real pointer can drive the hover-only hero effects. */
export function useHasFinePointer(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}

export function useIsDesktopViewport(): boolean {
  return useMediaQuery(DESKTOP_STAGE_QUERY);
}

export function useIsCompactViewport(): boolean {
  return useMediaQuery(`(width < ${String(BREAKPOINT.lg)}px)`);
}
