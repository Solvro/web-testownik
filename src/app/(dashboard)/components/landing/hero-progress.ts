/**
 * The hero publishes its scroll progress (0 → 1, closed → fully open) as a CSS
 * custom property on the hero element, and announces every change on `window`.
 *
 * A DOM event rather than React state on purpose: the consumers are the WebGL
 * scene and the vendored CanvasUI `Glass`, neither of which renders through the
 * React tree that owns the value, and the value changes on every animation
 * frame while scrolling. Keeping it out of React state avoids re-rendering the
 * whole landing page 60 times a second.
 */
export const HERO_PROGRESS_PROPERTY = "--landing-hero-progress";
export const HERO_PROGRESS_EVENT = "landing-hero-progress";
export const HERO_PROGRESS = `var(${HERO_PROGRESS_PROPERTY}, 0)`;

/** Reads the published progress off any element inside the hero. */
export function readHeroProgress(element: Element): number {
  const value = Number.parseFloat(
    getComputedStyle(element).getPropertyValue(HERO_PROGRESS_PROPERTY),
  );
  return Number.isFinite(value) ? value : 0;
}
