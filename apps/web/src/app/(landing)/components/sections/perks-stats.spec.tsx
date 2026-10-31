import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { perks as snapshot } from "../../data/perks";
import { PerksStats } from "./perks-stats";

let intersect: (visible: boolean, ratio?: number) => void;
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
        intersect = (visible, ratio = visible ? 1 : 0) => {
          callback(
            [
              {
                isIntersecting: visible,
                intersectionRatio: ratio,
              } as IntersectionObserverEntry,
            ],
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
    Number(node.textContent.replaceAll(/\D/g, "")),
  );
}

describe("partner stats", () => {
  it("counts only on entering, increments at separate rates, and pauses offscreen", async () => {
    const { container } = render(<PerksStats />);
    await act(() => vi.advanceTimersByTime(5000));
    expect(numbers(container)).toEqual([0, 0, 0]);
    act(() => {
      intersect(true, 0.1);
    });
    await act(() => vi.advanceTimersByTime(2000));
    expect(numbers(container)).toEqual([0, 0, 0]);
    act(() => {
      intersect(true);
    });
    await act(() => vi.advanceTimersByTime(800));
    expect(numbers(container)[0]).toBeGreaterThan(snapshot.studentsCount * 0.9);
    expect(numbers(container)[0]).toBeLessThan(snapshot.studentsCount);
    await act(() => vi.advanceTimersByTime(1200));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount,
      snapshot.offersCount,
      2000,
    ]);
    await act(() => vi.advanceTimersByTime(4000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount + 1,
      snapshot.offersCount,
      2000,
    ]);
    await act(() => vi.advanceTimersByTime(24_000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount + 7,
      snapshot.offersCount + 1,
      2000,
    ]);
    act(() => {
      intersect(false);
    });
    await act(() => vi.advanceTimersByTime(60_000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount + 7,
      snapshot.offersCount + 1,
      2000,
    ]);
    act(() => {
      intersect(true);
    });
    await act(() => vi.advanceTimersByTime(4000));
    expect(numbers(container)[0]).toBe(snapshot.studentsCount + 8);
  });

  it("shows fixed base values with reduced motion and clears work on unmount", async () => {
    reduced = true;
    const { container, unmount } = render(<PerksStats />);
    act(() => {
      intersect(true);
    });
    await act(() => vi.advanceTimersByTime(60_000));
    expect(numbers(container)).toEqual([
      snapshot.studentsCount,
      snapshot.offersCount,
      2000,
    ]);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
