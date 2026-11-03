import { DESKTOP_STAGE_QUERY } from "./breakpoints";

/**
 * Scrolls to a landing section. The hero is a tall scroll-driven stage whose
 * top is the closed laptop; on desktop, "Start" goes to the end of that
 * travel instead, where the devices are open, unless the hero has fallen back
 * to its static layout.
 */
export function scrollToLandingSection(target: HTMLElement): void {
  const behavior: ScrollBehavior = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches
    ? "auto"
    : "smooth";

  if (
    target.id === "start" &&
    target.dataset.heroStatic === "false" &&
    window.matchMedia(DESKTOP_STAGE_QUERY).matches
  ) {
    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + Math.max(target.offsetHeight - window.innerHeight, 0),
      behavior,
    });
    return;
  }

  target.scrollIntoView({ behavior, block: "start" });
}

/** Clicks the browser should handle itself: new tab, new window, download. */
export function isModifiedClick(event: React.MouseEvent): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * Click handler for in-page `#id` links: scrolls the landing way, updates the
 * hash and moves focus to the destination (which needs `tabIndex={-1}`), so
 * the next Tab continues from there. Returns the target, or `null` when the
 * browser was left to handle the click.
 */
export function followLandingSectionLink(
  event: React.MouseEvent<HTMLAnchorElement>,
  id: string,
): HTMLElement | null {
  if (isModifiedClick(event)) {
    return null;
  }
  const target = document.getElementById(id);
  if (target === null) {
    return null;
  }
  event.preventDefault();
  scrollToLandingSection(target);
  window.history.replaceState(null, "", `#${id}`);
  target.focus({ preventScroll: true });
  return target;
}
