import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import snapshot from "../../data/perks";
import { PerksStats } from "./perks-stats";

let intersect: (visible: boolean) => void;
let reduced = false;

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = (visible) => {
          callback(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        };
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function numbers(container: HTMLElement) {
  return [...container.querySelectorAll("dd [aria-hidden]")].map((node) =>
    Number(node.textContent?.replaceAll(/\D/g, "")),
  );
}

describe("partner stats", () => {
  it("counts only on entering, increments at separate rates, and pauses offscreen", () => {
    const { container } = render(<PerksStats />);
    act(() => vi.advanceTimersByTime(5000));
    expect(numbers(container)).toEqual([0, 0, 0]);
    act(() => {
      intersect(true);
    });
    act(() => vi.advanceTimersByTime(800));
    expect(numbers(container)[0]).toBeGreaterThan(0);
    expect(numbers(container)[0]).toBeLessThan(snapshot.studentsCount);
    act(() => vi.advanceTimersByTime(1000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount,
      snapshot.offersCount,
      2000,
    ]);
    act(() => vi.advanceTimersByTime(4000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount + 1,
      snapshot.offersCount,
      2000,
    ]);
    act(() => vi.advanceTimersByTime(24_000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount + 7,
      snapshot.offersCount + 1,
      2000,
    ]);
    act(() => {
      intersect(false);
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount + 7,
      snapshot.offersCount + 1,
      2000,
    ]);
    act(() => {
      intersect(true);
    });
    act(() => vi.advanceTimersByTime(4000));
    expect(numbers(container)[0]).toBe(snapshot.studentsCount + 8);
  });

  it("shows fixed base values with reduced motion and clears work on unmount", () => {
    reduced = true;
    const { container, unmount } = render(<PerksStats />);
    act(() => {
      intersect(true);
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount,
      snapshot.offersCount,
      2000,
    ]);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
