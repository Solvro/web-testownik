import { describe, expect, it } from "vitest";

import { createPageScrollOwnership } from "./page-scroll-ownership";

describe("page scroll ownership shared by device frames", () => {
  it("allows consecutive laptop and phone wheels, despite all frames observing each scroll", () => {
    const ownership = createPageScrollOwnership();
    expect(ownership.isNativeChaining(0)).toBe(false);
    // Laptop +30. All three mounted frames observe the same page scroll.
    ownership.recordForwardedScroll(0, 30, 0);
    for (let frame = 0; frame < 3; frame++) {
      ownership.observePageScroll(0, 30, 1);
    }
    expect(ownership.isNativeChaining(16)).toBe(false);
    // Phone +30 on the next animation frame must also move the page.
    ownership.recordForwardedScroll(0, 60, 16);
    for (let frame = 0; frame < 3; frame++) {
      ownership.observePageScroll(0, 60, 17);
    }
    expect(ownership.isNativeChaining(32)).toBe(false);
  });

  it("still de-duplicates native Chrome chaining over tilted frames", () => {
    const ownership = createPageScrollOwnership();
    ownership.recordForwardedScroll(0, 30, 0);
    ownership.observePageScroll(0, 30, 1);
    // Chrome then moves the page without any forwarded scrollBy.
    ownership.observePageScroll(0, 60, 16);
    expect(ownership.isNativeChaining(17)).toBe(true);
    expect(ownership.isNativeChaining(115)).toBe(true);
    expect(ownership.isNativeChaining(116)).toBe(false);
  });

  it("recognizes a horizontal native scroll even if the Y position matches", () => {
    const ownership = createPageScrollOwnership();
    ownership.recordForwardedScroll(0, 30, 0);
    ownership.observePageScroll(20, 30, 1);
    expect(ownership.isNativeChaining(2)).toBe(true);
  });

  it("expires old ownership rather than attributing later native scrolls to it", () => {
    const ownership = createPageScrollOwnership();
    ownership.recordForwardedScroll(0, 30.5, 0);
    ownership.observePageScroll(0, 30.5, 1);
    expect(ownership.isNativeChaining(2)).toBe(false);
    ownership.observePageScroll(0, 30.5, 100);
    expect(ownership.isNativeChaining(101)).toBe(true);
  });
});
