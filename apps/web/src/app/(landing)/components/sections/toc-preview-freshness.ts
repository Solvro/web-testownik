/**
 * Keeping TOC peeks current: which section to re-clone next, and the bits of
 * live state `cloneNode` does not carry over. Free of scheduling and layout
 * so it can be unit-tested; `toc-section-preview.ts` drives it.
 */

/** Attribute flips that change what a section looks like (accordion, tabs). */
export const TOC_PREVIEW_OBSERVED_ATTRIBUTES = [
  "class",
  "aria-expanded",
  "aria-selected",
  "aria-checked",
  "data-state",
  "disabled",
  "open",
];

interface SectionFreshness {
  built: boolean;
  /** Markup or attributes changed since the last build. */
  dirty: boolean;
  /** Only an inner scroller moved; refreshed for the peek on screen only. */
  scrolled: boolean;
  builtAt: number;
}

export interface TocPreviewSchedule {
  now: number;
  /** The rail is on screen, so a peek may be requested soon. */
  visible: boolean;
  /** The page or an inner scroller is scrolling. */
  scrolling: boolean;
  /** The section whose peek is on screen, if any. */
  shown: string | null;
}

/**
 * Per-section dirty tracking with a per-section rate limit.
 *
 * - Never-built sections come first, in order, whatever the rail is doing:
 *   that is the initial warm-up.
 * - The peek on screen is refreshed when anything changed, scroll included.
 * - Other dirty sections are refreshed only while the rail is visible, so a
 *   hover usually finds a current clone already parked.
 * - Nothing is rebuilt while scrolling, and a section is rebuilt at most once
 *   per `minInterval`.
 */
export class TocPreviewFreshness {
  private readonly sections = new Map<string, SectionFreshness>();

  constructor(
    ids: readonly string[],
    private readonly minInterval = 1000,
  ) {
    for (const id of ids) {
      this.sections.set(id, {
        built: false,
        dirty: false,
        scrolled: false,
        builtAt: Number.NEGATIVE_INFINITY,
      });
    }
  }

  markDirty(id: string): void {
    const section = this.sections.get(id);
    if (section !== undefined) {
      section.dirty = true;
    }
  }

  markScrolled(id: string): void {
    const section = this.sections.get(id);
    if (section !== undefined) {
      section.scrolled = true;
    }
  }

  markBuilt(id: string, now: number): void {
    const section = this.sections.get(id);
    if (section !== undefined) {
      section.built = true;
      section.dirty = false;
      section.scrolled = false;
      section.builtAt = now;
    }
  }

  /** Forget every build (resize, theme change): all sections warm again. */
  reset(): void {
    for (const section of this.sections.values()) {
      section.built = false;
      section.dirty = false;
      section.scrolled = false;
      section.builtAt = Number.NEGATIVE_INFINITY;
    }
  }

  isStale(id: string): boolean {
    const section = this.sections.get(id);
    return (
      section !== undefined &&
      (!section.built || section.dirty || section.scrolled)
    );
  }

  private wantsRefresh(
    id: string,
    section: SectionFreshness,
    schedule: TocPreviewSchedule,
  ): boolean {
    if (!section.built) {
      return true;
    }
    if (id === schedule.shown) {
      return section.dirty || section.scrolled;
    }
    return schedule.visible && section.dirty;
  }

  /** The one section to build in this idle slot, or `null`. */
  next(schedule: TocPreviewSchedule): string | null {
    if (schedule.scrolling) {
      return null;
    }
    for (const [id, section] of this.sections) {
      if (!section.built) {
        return id;
      }
    }
    if (schedule.shown !== null) {
      const shown = this.sections.get(schedule.shown);
      if (
        shown !== undefined &&
        this.wantsRefresh(schedule.shown, shown, schedule) &&
        schedule.now - shown.builtAt >= this.minInterval
      ) {
        return schedule.shown;
      }
    }
    for (const [id, section] of this.sections) {
      if (
        this.wantsRefresh(id, section, schedule) &&
        schedule.now - section.builtAt >= this.minInterval
      ) {
        return id;
      }
    }
    return null;
  }

  /**
   * Milliseconds until a wanted refresh clears its rate limit (0 if one is due
   * now), or `null` when nothing is wanted. Ignores `scrolling`: the caller
   * waits for scroll to settle separately.
   */
  delay(schedule: TocPreviewSchedule): number | null {
    let wait: number | null = null;
    for (const [id, section] of this.sections) {
      if (!this.wantsRefresh(id, section, schedule)) {
        continue;
      }
      const remaining = Math.max(
        0,
        section.builtAt + this.minInterval - schedule.now,
      );
      wait = wait === null ? remaining : Math.min(wait, remaining);
    }
    return wait;
  }
}

export interface ScrollableLike {
  scrollTop: number;
  scrollLeft: number;
}

/** A scrolled element, by its index in a document-order element list. */
export interface ScrollOffset {
  index: number;
  top: number;
  left: number;
}

/**
 * Inner scroll positions of a live subtree. `elements` is the subtree in
 * document order (`querySelectorAll("*")`); a fresh deep clone lists its
 * elements in the same order, so an index is enough to find the twin.
 */
export function captureScrollOffsets(
  elements: Iterable<ScrollableLike>,
): ScrollOffset[] {
  const offsets: ScrollOffset[] = [];
  let index = -1;
  for (const { scrollTop, scrollLeft } of elements) {
    index += 1;
    if (scrollTop !== 0 || scrollLeft !== 0) {
      offsets.push({ index, top: scrollTop, left: scrollLeft });
    }
  }
  return offsets;
}

/** Replay `captureScrollOffsets` onto the clone once it has been laid out. */
export function applyScrollOffsets(
  elements: ArrayLike<ScrollableLike>,
  offsets: readonly ScrollOffset[],
): void {
  for (const { index, top, left } of offsets) {
    const element = elements[index] as ScrollableLike | undefined;
    if (element === undefined) {
      continue;
    }
    element.scrollTop = top;
    element.scrollLeft = left;
  }
}

/**
 * Form state that lives in properties, not attributes. `input` and `textarea`
 * clone their current value and checkedness already; this covers `select`
 * and is explicit about the rest, so a peek matches the live controls.
 * Both lists must come from the same subtree shape (live and its deep clone).
 */
export function copyControlState(
  live: ArrayLike<Element>,
  clone: ArrayLike<Element>,
): void {
  const count = Math.min(live.length, clone.length);
  for (let index = 0; index < count; index += 1) {
    const source = live[index];
    const target = clone[index];
    if (
      source instanceof HTMLInputElement &&
      target instanceof HTMLInputElement
    ) {
      target.checked = source.checked;
      target.indeterminate = source.indeterminate;
      if (source.type !== "file") {
        target.value = source.value;
      }
    } else if (
      source instanceof HTMLTextAreaElement &&
      target instanceof HTMLTextAreaElement
    ) {
      target.value = source.value;
    } else if (
      source instanceof HTMLSelectElement &&
      target instanceof HTMLSelectElement
    ) {
      target.selectedIndex = source.selectedIndex;
    }
  }
}
