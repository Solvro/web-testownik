import { describe, expect, it } from "vitest";

import {
  TocPreviewFreshness,
  applyScrollOffsets,
  captureScrollOffsets,
  copyControlState,
} from "./toc-preview-freshness";
import type { TocPreviewSchedule } from "./toc-preview-freshness";

const IDS = ["start", "features", "faq"] as const;

function at(
  now: number,
  overrides: Partial<TocPreviewSchedule> = {},
): TocPreviewSchedule {
  return { now, visible: true, scrolling: false, shown: null, ...overrides };
}

function warmed(minInterval = 1000): TocPreviewFreshness {
  const tracker = new TocPreviewFreshness(IDS, minInterval);
  for (const id of IDS) {
    tracker.markBuilt(id, 0);
  }
  return tracker;
}

describe("TocPreviewFreshness", () => {
  it("warms unbuilt sections in order, rail hidden or not", () => {
    const tracker = new TocPreviewFreshness(IDS);
    expect(tracker.next(at(0, { visible: false }))).toBe("start");
    tracker.markBuilt("start", 0);
    expect(tracker.next(at(0, { visible: false }))).toBe("features");
    tracker.markBuilt("features", 0);
    tracker.markBuilt("faq", 0);
    expect(tracker.next(at(0))).toBeNull();
    expect(tracker.delay(at(0))).toBeNull();
  });

  it("never builds while scrolling", () => {
    const tracker = new TocPreviewFreshness(IDS);
    expect(tracker.next(at(0, { scrolling: true }))).toBeNull();
    tracker.markBuilt("start", 0);
    tracker.markBuilt("features", 0);
    tracker.markBuilt("faq", 0);
    tracker.markDirty("faq");
    expect(tracker.next(at(5000, { scrolling: true }))).toBeNull();
    expect(tracker.next(at(5000))).toBe("faq");
  });

  it("refreshes dirty sections only while the rail is visible", () => {
    const tracker = warmed();
    tracker.markDirty("faq");
    expect(tracker.isStale("faq")).toBe(true);
    expect(tracker.next(at(2000, { visible: false }))).toBeNull();
    expect(tracker.delay(at(2000, { visible: false }))).toBeNull();
    expect(tracker.next(at(2000))).toBe("faq");
    tracker.markBuilt("faq", 2000);
    expect(tracker.isStale("faq")).toBe(false);
    expect(tracker.next(at(2000))).toBeNull();
  });

  it("rate-limits each section to one rebuild per interval", () => {
    const tracker = warmed(1000);
    tracker.markBuilt("faq", 500);
    tracker.markDirty("faq");
    expect(tracker.next(at(900))).toBeNull();
    expect(tracker.delay(at(900))).toBe(600);
    expect(tracker.next(at(1500))).toBe("faq");
    expect(tracker.delay(at(1500))).toBe(0);
  });

  it("puts the peek on screen first, and refreshes it for scroll alone", () => {
    const tracker = warmed();
    tracker.markDirty("features");
    tracker.markScrolled("faq");
    // Scroll-only changes wait for a hover.
    expect(tracker.next(at(2000))).toBe("features");
    expect(tracker.next(at(2000, { shown: "faq" }))).toBe("faq");
    // The peek on screen refreshes even while the rail itself is hidden.
    expect(tracker.next(at(2000, { shown: "faq", visible: false }))).toBe(
      "faq",
    );
  });

  it("forgets every build on reset", () => {
    const tracker = warmed();
    tracker.reset();
    expect(tracker.isStale("start")).toBe(true);
    expect(tracker.next(at(0, { visible: false }))).toBe("start");
  });

  it("ignores unknown ids", () => {
    const tracker = warmed();
    tracker.markDirty("nope");
    tracker.markScrolled("nope");
    expect(tracker.isStale("nope")).toBe(false);
    expect(tracker.next(at(5000))).toBeNull();
  });
});

describe("scroll offsets", () => {
  it("captures only scrolled elements, by document-order index", () => {
    const live = [
      { scrollTop: 0, scrollLeft: 0 },
      { scrollTop: 120, scrollLeft: 0 },
      { scrollTop: 0, scrollLeft: 0 },
      { scrollTop: 0, scrollLeft: 48 },
    ];
    expect(captureScrollOffsets(live)).toEqual([
      { index: 1, top: 120, left: 0 },
      { index: 3, top: 0, left: 48 },
    ]);
  });

  it("replays offsets onto the matching clone elements", () => {
    const clone = Array.from({ length: 4 }, () => ({
      scrollTop: 0,
      scrollLeft: 0,
    }));
    applyScrollOffsets(clone, [
      { index: 1, top: 120, left: 0 },
      { index: 3, top: 0, left: 48 },
      { index: 9, top: 5, left: 5 },
    ]);
    expect(clone).toEqual([
      { scrollTop: 0, scrollLeft: 0 },
      { scrollTop: 120, scrollLeft: 0 },
      { scrollTop: 0, scrollLeft: 0 },
      { scrollTop: 0, scrollLeft: 48 },
    ]);
  });
});

describe("copyControlState", () => {
  it("carries property-only form state over to a deep clone", () => {
    const live = document.createElement("form");
    live.innerHTML = `
      <input type="checkbox" />
      <input type="text" />
      <textarea></textarea>
      <select><option>a</option><option>b</option><option>c</option></select>
    `;
    const clone = live.cloneNode(true) as HTMLFormElement;

    const [checkbox, text] = live.querySelectorAll("input");
    const [textarea] = live.querySelectorAll("textarea");
    const [select] = live.querySelectorAll("select");
    checkbox.checked = true;
    text.value = "typed";
    textarea.value = "draft";
    select.selectedIndex = 2;

    copyControlState(live.querySelectorAll("*"), clone.querySelectorAll("*"));

    const [cloneCheckbox, cloneText] = clone.querySelectorAll("input");
    expect(cloneCheckbox.checked).toBe(true);
    expect(cloneText.value).toBe("typed");
    expect(clone.querySelectorAll("textarea")[0].value).toBe("draft");
    expect(clone.querySelectorAll("select")[0].selectedIndex).toBe(2);
  });
});
