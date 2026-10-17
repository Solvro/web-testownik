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

/**
 * True at and above `lg`, where the hero mounts its desktop stage. False on the
 * server and during hydration, so the server markup is always the light hero.
 */
export function useIsDesktopViewport(): boolean {
  return useMediaQuery(DESKTOP_STAGE_QUERY);
}

/**
 * True below `lg`, where the hero has no 3D stage and other effects scale down
 * with it. Also false on the server, so it only ever enables compact-only work.
 */
export function useIsCompactViewport(): boolean {
  return useMediaQuery(`(width < ${String(BREAKPOINT.lg)}px)`);
}
