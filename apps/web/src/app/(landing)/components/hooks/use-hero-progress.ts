"use client";

import { useLayoutEffect } from "react";

import { publishHeroProgress } from "../hero-progress";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Progress is how far the hero's top has travelled past the top of the window.
 * With reduced motion it is pinned at 1, so the laptop renders open.
 *
 * Call it from `Hero`, which owns the section ref, never from a child: a cached
 * lazy child mounts in the same commit, and its layout effect runs before the
 * parent's ref is attached, so the hook would bail out for good.
 */
export function useHeroProgress(
  heroReference: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  const prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const hero = heroReference.current;
    if (!enabled || hero === null) {
      return;
    }

    let frame = 0;
    let top = 0;
    let travel = 1;

    const update = (): void => {
      frame = 0;
      const progress = prefersReducedMotion
        ? 1
        : clamp((window.scrollY - top) / travel);
      publishHeroProgress(progress);
    };

    const schedule = (): void => {
      frame ||= window.requestAnimationFrame(update);
    };

    // Measure only when geometry can change, before publishing any styles.
    // The scroll path uses the cached document position and never forces layout.
    const measure = (): void => {
      top = hero.getBoundingClientRect().top + window.scrollY;
      travel = Math.max(hero.offsetHeight - window.innerHeight, 1);
      schedule();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(hero);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    // A back/forward-cache restore brings the page back at an arbitrary
    // scroll position without a scroll event.
    window.addEventListener("pageshow", measure);
    measure();
    window.cancelAnimationFrame(frame);
    update();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      observer.disconnect();
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      // Reset the scene's cached value too, so CSS and WebGL never disagree
      // the next time the stage mounts.
      publishHeroProgress(0);
    };
  }, [enabled, heroReference, prefersReducedMotion]);
}
