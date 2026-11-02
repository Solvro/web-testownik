import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PerksStats } from "./perks-stats";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function displayedValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>("[data-perk-count]")].map(
    (node) => node.textContent.replaceAll(/\s/g, ""),
  );
}

describe("partner stats", () => {
  it("shows final bounds without IntersectionObserver, with savings as an upper bound", () => {
    const { container } = render(<PerksStats />);
    expect(displayedValues(container)).toEqual(["500000", "250", "2000"]);
    expect(container.querySelectorAll("dd")[0].textContent).toMatch(/\+$/);
    expect(container.querySelectorAll("dd")[1].textContent).toMatch(/\+$/);
    expect(container.querySelectorAll("dd")[2].textContent).toMatch(/^do\s/);
    expect(container.querySelectorAll("dd")[2].textContent).toMatch(/zł$/);
    expect(
      [...container.querySelectorAll("dt")].map((node) => node.textContent),
    ).toEqual(["studentów", "ofert do\u00A0−50%", "oszczędności rocznie"]);
  });

  it("counts from the requested starting values, reaches exact totals, and cancels on unmount", () => {
    let reveal: IntersectionObserverCallback = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          reveal = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    let tick: FrameRequestCallback = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        tick = callback;
        return 1;
      }),
    );
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    vi.spyOn(performance, "now").mockReturnValue(0);
    const { container, unmount } = render(<PerksStats />);
    expect(displayedValues(container)).toEqual(["100000", "100", "1000"]);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    reveal(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(disconnect).toHaveBeenCalledOnce();
    // A frame timestamp can precede the observer callback's performance.now().
    tick(-16);
    expect(displayedValues(container)).toEqual(["100000", "100", "1000"]);
    tick(0);
    expect(displayedValues(container)).toEqual(["100000", "100", "1000"]);
    tick(600);
    expect(displayedValues(container)).toEqual(["450000", "231", "1875"]);
    tick(1200);
    expect(displayedValues(container)).toEqual(["500000", "250", "2000"]);
    tick(1500);
    expect(displayedValues(container)).toEqual(["500000", "250", "2000"]);
    unmount();
    expect(cancel).toHaveBeenCalledWith(1);
  });

  it("keeps final values without starting a counter for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    const { container } = render(<PerksStats />);
    expect(displayedValues(container)).toEqual(["500000", "250", "2000"]);
    expect(observer).not.toHaveBeenCalled();
  });
});
