import { describe, expect, it, vi } from "vitest";

import {
  BoundedCache,
  TOC_PREVIEW_INNER_HEIGHT,
  TOC_PREVIEW_INNER_WIDTH,
  TOC_PREVIEW_MIN_LAYOUT_WIDTH,
  tocPreviewLayout,
  tocPreviewOffset,
} from "./toc-preview-layout";

describe("tocPreviewLayout", () => {
  it("lays out at the viewport width and keeps the peek aspect", () => {
    const layout = tocPreviewLayout(1440);
    expect(layout.layoutWidth).toBe(1440);
    expect(layout.scale).toBeCloseTo(TOC_PREVIEW_INNER_WIDTH / 1440);
    expect(layout.windowHeight * layout.scale).toBeCloseTo(
      TOC_PREVIEW_INNER_HEIGHT,
      0,
    );
  });

  it("never lays out narrower than the desktop minimum", () => {
    const layout = tocPreviewLayout(800);
    expect(layout.layoutWidth).toBe(TOC_PREVIEW_MIN_LAYOUT_WIDTH);
    expect(layout.scale).toBeCloseTo(
      TOC_PREVIEW_INNER_WIDTH / TOC_PREVIEW_MIN_LAYOUT_WIDTH,
    );
  });

  it("rounds fractional viewport widths", () => {
    expect(tocPreviewLayout(1439.6).layoutWidth).toBe(1440);
  });
});

describe("tocPreviewOffset", () => {
  it("keeps top-aligned sections at the top", () => {
    expect(tocPreviewOffset(1200, 750, "top")).toBe(0);
  });

  it("centres a taller section in the window", () => {
    expect(tocPreviewOffset(900, 752, "center")).toBe(74);
  });

  it("does not shift content that already fits", () => {
    expect(tocPreviewOffset(600, 752, "center")).toBe(0);
  });
});

describe("BoundedCache", () => {
  it("evicts the least recently used entry past the limit", () => {
    const onEvict = vi.fn();
    const cache = new BoundedCache<string, number>(2, onEvict);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(onEvict).toHaveBeenCalledExactlyOnceWith(2, "b");
  });

  it("reports replaced values but not a re-set of the same value", () => {
    const onEvict = vi.fn();
    const cache = new BoundedCache<string, object>(4, onEvict);
    const first = {};
    cache.set("a", first);
    cache.set("a", first);
    expect(onEvict).not.toHaveBeenCalled();

    const second = {};
    cache.set("a", second);
    expect(onEvict).toHaveBeenCalledExactlyOnceWith(first, "a");
    expect(cache.get("a")).toBe(second);
  });

  it("evicts everything on clear", () => {
    const onEvict = vi.fn();
    const cache = new BoundedCache<string, number>(4, onEvict);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(onEvict).toHaveBeenCalledTimes(2);
  });
});
