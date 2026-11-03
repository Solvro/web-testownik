import { DESKTOP_STAGE_QUERY } from "./breakpoints";

/**
 * On desktop the hero target is the end of its scroll travel, where the
 * devices are open, unless the hero has fallen back to its static layout.
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
 * For in-page `#id` links. Moves focus to the target (which needs
 * `tabIndex={-1}`) and returns it, or `null` when the browser handles the click.
 */
export function followLandingSectionLink(
  event: React.MouseEvent<HTMLAnchorElement>,
  id: string,
): HTMLElement | null {
  if (isModifiedClick(event)) {
    return null;
  }
  const target = document.querySelector(`#${CSS.escape(id)}`);
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  event.preventDefault();
  scrollToLandingSection(target);
  window.history.replaceState(null, "", `#${id}`);
  target.focus({ preventScroll: true });
  return target;
}
