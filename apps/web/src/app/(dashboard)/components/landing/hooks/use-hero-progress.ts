"use client";

import { useLayoutEffect } from "react";

import { HERO_PROGRESS_PROPERTY, publishHeroProgress } from "../hero-progress";
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
 *
 * Only the desktop stage calls this, so phones never attach the listeners. On
 * unmount (the viewport dropped below `lg`) the inline value is removed and the
 * section's own `--landing-hero-progress: 0` takes over again, leaving the
 * shared copy fully visible.
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
      hero.style.removeProperty(HERO_PROGRESS_PROPERTY);
    };
  }, [heroReference, prefersReducedMotion]);
}
