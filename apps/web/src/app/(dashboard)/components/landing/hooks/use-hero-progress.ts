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
 * `Hero` owns the section ref and calls this itself, with `enabled` true only
 * on desktop viewports, so phones never attach the listeners. It must not be
 * called from a child: a lazily loaded child that is already cached mounts in
 * the same commit as the section, and its layout effect runs before the
 * parent's ref is attached, which would make the hook bail out for good while
 * the scene kept a stale cached progress (the "open devices under the
 * headline" freeze).
 *
 * When disabled (the viewport dropped below `lg`) the inline value is removed,
 * the shared cache is reset, and the section's own `--landing-hero-progress: 0`
 * takes over again, leaving the shared copy fully visible.
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
    // A back/forward-cache restore brings the page back at an arbitrary
    // scroll position without a scroll event.
    window.addEventListener("pageshow", schedule);
    update();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      // Reset the scene's cached value too, so CSS and WebGL never disagree
      // the next time the stage mounts.
      publishHeroProgress(hero, 0);
      hero.style.removeProperty(HERO_PROGRESS_PROPERTY);
    };
  }, [enabled, heroReference, prefersReducedMotion]);
}
