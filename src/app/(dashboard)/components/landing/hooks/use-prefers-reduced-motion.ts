"use client";

import { BREAKPOINT } from "../breakpoints";
import { useMediaQuery } from "./use-media-query";

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True only where a real pointer can drive the hover-only hero effects. */
export function useHasFinePointer(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}

/** Matches the breakpoint below which the hero drops the 3D scene entirely. */
export function useIsCompactViewport(): boolean {
  return useMediaQuery(`(width < ${String(BREAKPOINT.sm)}px)`);
}
