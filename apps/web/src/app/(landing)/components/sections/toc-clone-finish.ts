/**
 * A peek shows a section as the visitor will find it, so reveal effects that
 * have not run yet on the live page are shown finished in the clone.
 */

/** Perks counters count up on reveal; show the final figure. */
export function finishPerkCounters(clone: HTMLElement): void {
  for (const counter of clone.querySelectorAll<HTMLElement>(
    "[data-perk-count]",
  )) {
    counter.textContent = counter.dataset.perkCount ?? "";
  }
}

/**
 * Story events reveal as the pen stroke reaches them: the stroke draws down,
 * titles type themselves out and dates and descriptions fade in.
 */
export function finishTimelineReveal(clone: HTMLElement): void {
  for (const event of clone.querySelectorAll<HTMLElement>(
    "[data-timeline-revealed]",
  )) {
    event.dataset.timelineRevealed = "true";
  }
  for (const title of clone.querySelectorAll<HTMLElement>(
    "[data-timeline-title]",
  )) {
    title.textContent = title.dataset.timelineTitle ?? "";
  }
  for (const ink of clone.querySelectorAll<SVGElement>("[data-timeline-ink]")) {
    ink.style.strokeDashoffset = "0";
  }
}

export function finishReveals(clone: HTMLElement): void {
  finishPerkCounters(clone);
  finishTimelineReveal(clone);
}
