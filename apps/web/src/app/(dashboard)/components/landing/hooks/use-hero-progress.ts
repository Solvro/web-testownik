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
 *
 * `Hero` owns the section ref and calls this itself, with `enabled` true only
 * on desktop viewports, so phones never attach the listeners. It must not be
 * called from a child: a lazily loaded child that is already cached mounts in
 * the same commit as the section, and its layout effect runs before the
 * parent's ref is attached, which would make the hook bail out for good while
 * the scene kept a stale cached progress (the "open devices under the
 * headline" freeze).
 *
 * When disabled (the viewport dropped below `lg`) the targets and shared cache
 * reset to zero, leaving the shared copy fully visible.
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
