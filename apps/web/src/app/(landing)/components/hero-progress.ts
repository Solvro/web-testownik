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
const targets = new Set<HTMLElement>();

function shownProgress(): number {
  return isHeld ? 0 : cachedHeroProgress;
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
  if (!isHeld) {
    for (const element of targets) {
      element.style.setProperty(HERO_PROGRESS_PROPERTY, next.toString());
    }
  }
  window.dispatchEvent(new Event(HERO_PROGRESS_EVENT));
}

/**
 * Keeps the copy, badges and other DOM targets at the closed pose while the
 * device stack is still loading, whatever the scroll position; the scene
 * itself does the same and catches up once ready. Releasing re-applies the
 * real progress at once, so the hero styles the catch-up with a transition.
 * `getHeroProgress` always reports the real value.
 */
export function setHeroProgressHold(held: boolean): void {
  if (held === isHeld) {
    return;
  }
  isHeld = held;
  const shown = shownProgress().toString();
  for (const element of targets) {
    element.style.setProperty(HERO_PROGRESS_PROPERTY, shown);
  }
}
