"use client";

import { useLayoutEffect } from "react";

import { publishHeroProgress } from "../hero-progress";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Drives the hero's scroll progress. The hero is a tall section with a sticky
 * viewport-sized stage, so progress is simply how far its top has travelled
 * past the top of the window.
 *
 * With reduced motion the hero is pinned at 1 — the laptop renders open and
 * nothing animates on scroll.
 */
export function useHeroProgress(
  heroReference: React.RefObject<HTMLElement | null>,
): void {
  const prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const hero = heroReference.current;
    if (hero === null) {
      return;
    }

    let frame = 0;

    const update = (): void => {
      frame = 0;
      const travel = Math.max(hero.offsetHeight - window.innerHeight, 1);
      const progress = prefersReducedMotion
        ? 1
        : clamp(-hero.getBoundingClientRect().top / travel);
      publishHeroProgress(hero, progress);
    };

    const schedule = (): void => {
      frame ||= window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [heroReference, prefersReducedMotion]);
}
