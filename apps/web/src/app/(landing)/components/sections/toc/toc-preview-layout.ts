export const TOC_PREVIEW_INNER_WIDTH = 268;
export const TOC_PREVIEW_INNER_HEIGHT = 140;
export const TOC_PREVIEW_WIDTH = TOC_PREVIEW_INNER_WIDTH + 16;
export const TOC_PREVIEW_GAP = 14;
/** Narrowest layout a peek is laid out at, so type never reflows to mobile. */
export const TOC_PREVIEW_MIN_LAYOUT_WIDTH = 1024;

export type TocPreviewAlign = "top" | "center";

export interface TocPreviewLayout {
  layoutWidth: number;
  /** Height of the visible window, in unscaled layout pixels. */
  windowHeight: number;
  scale: number;
}

/** Every peek uses the same layout width and scale, so type size matches. */
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

/** A section shorter than the window is centred with a negative shift. */
export function tocPreviewOffset(
  contentHeight: number,
  windowHeight: number,
  align: TocPreviewAlign,
): number {
  if (align === "top") {
    return 0;
  }
  return Math.round((contentHeight - windowHeight) / 2);
}

/** An LRU cache; `onEvict` runs for every value that leaves, however it leaves. */
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
