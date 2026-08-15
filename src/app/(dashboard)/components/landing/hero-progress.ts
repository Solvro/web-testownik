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

let cachedHeroProgress = 0;

/** Latest progress written by `useHeroProgress`, readable without style recalc. */
export function getHeroProgress(): number {
  return cachedHeroProgress;
}

/**
 * Publishes progress to CSS and notifies listeners. The event fires only when
 * the quantized value changes so Glass and Three.js are not woken redundantly.
 */
export function publishHeroProgress(
  element: HTMLElement,
  progress: number,
): void {
  const clamped = Math.min(1, Math.max(0, progress));
  const quantized = clamped.toFixed(4);
  element.style.setProperty(HERO_PROGRESS_PROPERTY, quantized);

  const next = Number.parseFloat(quantized);
  if (next === cachedHeroProgress) {
    return;
  }

  cachedHeroProgress = next;
  window.dispatchEvent(new Event(HERO_PROGRESS_EVENT));
}

/** @deprecated Use `getHeroProgress()` — kept for callers outside the landing tree. */
export function readHeroProgress(_element: Element): number {
  return cachedHeroProgress;
}
