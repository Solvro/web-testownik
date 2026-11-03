/**
 * Scroll progress stays outside React. The CSS property is registered as
 * non-inheriting in landing.css, so updating it never restyles descendants.
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
 * Keeps the DOM targets at the closed pose while the device stack loads.
 * `getHeroProgress` still reports the real value.
 */
export function setHeroProgressHold(held: boolean): void {
  if (held === isHeld) {
    return;
  }
  isHeld = held;
  applyShownProgress();
}

/**
 * The stack publishes its catch-up from the closed pose here, so the copy and
 * badges travel with the devices. `null` returns to the real progress.
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
