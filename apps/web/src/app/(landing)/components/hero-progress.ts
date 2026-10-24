/**
 * Scroll progress stays outside React. Only the animated elements subscribe;
 * the CSS property is registered as non-inheriting in landing.css so changing
 * a badge never restyles its SVG, text or the rest of the hero.
 */
export const HERO_PROGRESS_PROPERTY = "--landing-hero-progress";
export const HERO_PROGRESS_EVENT = "landing-hero-progress";
export const HERO_PROGRESS = `var(${HERO_PROGRESS_PROPERTY}, 0)`;

let cachedHeroProgress = 0;
const targets = new Set<HTMLElement>();

/** Latest progress, readable by Three.js without a computed-style read. */
export function getHeroProgress(): number {
  return cachedHeroProgress;
}

/** React 19 callback ref: lazy-mounted targets immediately catch up. */
export function attachHeroProgress(
  element: HTMLElement | null,
): (() => void) | undefined {
  if (element === null) {
    return;
  }
  targets.add(element);
  element.style.setProperty(
    HERO_PROGRESS_PROPERTY,
    cachedHeroProgress.toString(),
  );
  return () => {
    targets.delete(element);
    element.style.removeProperty(HERO_PROGRESS_PROPERTY);
  };
}

/** Quantize before either DOM writes or the event, including at the endpoints. */
export function publishHeroProgress(progress: number): void {
  const next = Number.parseFloat(Math.min(1, Math.max(0, progress)).toFixed(4));
  if (next === cachedHeroProgress) {
    return;
  }

  cachedHeroProgress = next;
  for (const element of targets) {
    element.style.setProperty(HERO_PROGRESS_PROPERTY, next.toString());
  }
  window.dispatchEvent(new Event(HERO_PROGRESS_EVENT));
}
