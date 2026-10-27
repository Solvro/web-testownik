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
