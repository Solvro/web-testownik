/**
 * Scroll progress stays outside React. Only the animated elements subscribe;
 * the CSS property is registered as non-inheriting in landing.css so changing
 * a badge never restyles its SVG, text or the rest of the hero.
 */
export const HERO_PROGRESS_PROPERTY = "--landing-hero-progress";
export const HERO_PROGRESS_EVENT = "landing-hero-progress";
export const HERO_PROGRESS = `var(${HERO_PROGRESS_PROPERTY}, 0)`;

let cachedHeroProgress = 0;
/** While held, the DOM targets stay at 0 (the stack is still loading). */
let isHeld = false;
/** The device stack's own displayed progress while it catches up. */
let override: number | null = null;
const targets = new Set<HTMLElement>();

function shownProgress(): number {
  if (override !== null) {
    return override;
  }
  return isHeld ? 0 : cachedHeroProgress;
}

function applyShownProgress(): void {
  const shown = shownProgress().toString();
  for (const element of targets) {
    element.style.setProperty(HERO_PROGRESS_PROPERTY, shown);
  }
}

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
  element.style.setProperty(HERO_PROGRESS_PROPERTY, shownProgress().toString());
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
  if (!isHeld && override === null) {
    for (const element of targets) {
      element.style.setProperty(HERO_PROGRESS_PROPERTY, next.toString());
    }
  }
  window.dispatchEvent(new Event(HERO_PROGRESS_EVENT));
}

/**
 * Keeps the copy, badges and other DOM targets at the closed pose while the
 * device stack is still loading, whatever the scroll position, like the
 * scene under its cover. `getHeroProgress` always reports the real value.
 */
export function setHeroProgressHold(held: boolean): void {
  if (held === isHeld) {
    return;
  }
  isHeld = held;
  applyShownProgress();
}

/**
 * The stack, once ready, opens from the closed pose to wherever the page is
 * scrolled over a few hundred milliseconds; it publishes each frame of that
 * here so the copy and badges travel with the devices. `null` hands the DOM
 * targets back to the real progress.
 */
export function setHeroProgressOverride(progress: number | null): void {
  const next =
    progress === null
      ? null
      : Number.parseFloat(Math.min(1, Math.max(0, progress)).toFixed(4));
  if (next === override) {
    return;
  }
  override = next;
  applyShownProgress();
}
