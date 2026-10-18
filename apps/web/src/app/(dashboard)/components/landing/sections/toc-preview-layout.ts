/**
 * Pure geometry and caching for the TOC section peek. Kept free of the DOM so
 * it can be unit-tested; `toc-section-preview.ts` does the cloning.
 */

/** Inner screen width — same for every section peek. */
export const TOC_PREVIEW_INNER_WIDTH = 268;
/** Inner screen height — same for every section peek. */
export const TOC_PREVIEW_INNER_HEIGHT = 140;
/** Outer card width (inner screen + horizontal padding). */
export const TOC_PREVIEW_WIDTH = TOC_PREVIEW_INNER_WIDTH + 16;
/** Gap between the expanded TOC rail and the peek card. */
export const TOC_PREVIEW_GAP = 14;
/** Narrowest layout a peek is laid out at, so type never reflows to mobile. */
export const TOC_PREVIEW_MIN_LAYOUT_WIDTH = 1024;

/** Where a section's content sits inside the peek window. */
export type TocPreviewAlign = "top" | "center";

export interface TocPreviewLayout {
  /** Width the section is laid out at before scaling. */
  layoutWidth: number;
  /** Height of the visible window, in unscaled layout pixels. */
  windowHeight: number;
  /** Uniform scale from layout pixels to the peek screen. */
  scale: number;
}

/**
 * Every peek uses the same layout width and scale so type size stays
 * consistent between sections. The window keeps the peek screen's aspect, so
 * nothing laid out inside it is silently cropped by the card.
 */
export function tocPreviewLayout(viewportWidth: number): TocPreviewLayout {
  const layoutWidth = Math.max(
    Math.round(viewportWidth),
    TOC_PREVIEW_MIN_LAYOUT_WIDTH,
  );
  const scale = TOC_PREVIEW_INNER_WIDTH / layoutWidth;
  return {
    layoutWidth,
    windowHeight: Math.round(TOC_PREVIEW_INNER_HEIGHT / scale),
    scale,
  };
}

/** Vertical shift (layout pixels) that brings the aligned part into view. */
export function tocPreviewOffset(
  contentHeight: number,
  windowHeight: number,
  align: TocPreviewAlign,
): number {
  if (align === "top" || contentHeight <= windowHeight) {
    return 0;
  }
  return Math.round((contentHeight - windowHeight) / 2);
}

/**
 * Insertion-ordered cache that evicts the least recently used entry. `onEvict`
 * runs for every value that leaves, whether evicted, replaced or cleared.
 */
export class BoundedCache<Key, Value> {
  private readonly entries = new Map<Key, Value>();

  constructor(
    private readonly limit: number,
    private readonly onEvict?: (value: Value, key: Key) => void,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  has(key: Key): boolean {
    return this.entries.has(key);
  }

  get(key: Key): Value | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: Key, value: Value): void {
    const previous = this.entries.get(key);
    this.entries.delete(key);
    if (previous !== undefined && previous !== value) {
      this.onEvict?.(previous, key);
    }
    this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.entries().next();
      if (oldest.done === true) {
        break;
      }
      const [oldestKey, oldestValue] = oldest.value;
      this.entries.delete(oldestKey);
      this.onEvict?.(oldestValue, oldestKey);
    }
  }

  values(): IterableIterator<Value> {
    return this.entries.values();
  }

  clear(): void {
    const evicted = [...this.entries];
    this.entries.clear();
    for (const [key, value] of evicted) {
      this.onEvict?.(value, key);
    }
  }
}
