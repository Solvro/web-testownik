import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HERO_PROGRESS_EVENT,
  HERO_PROGRESS_PROPERTY,
  attachHeroProgress,
  getHeroProgress,
  publishHeroProgress,
} from "./hero-progress";
import { useHeroProgress } from "./hooks/use-hero-progress";

function Target(): React.JSX.Element {
  return <div data-testid="target" ref={attachHeroProgress} />;
}

function Hero({ enabled }: { enabled: boolean }): React.JSX.Element {
  const reference = useRef<HTMLElement>(null);
  useHeroProgress(reference, enabled);
  return (
    <section ref={reference}>
      <Target />
    </section>
  );
}

afterEach(() => {
  cleanup();
  publishHeroProgress(0);
  vi.restoreAllMocks();
});

describe("hero progress lifecycle", () => {
  it("catches up a lazy target and a remounted target without another scroll", () => {
    publishHeroProgress(0.625);
    const first = render(<Target />);
    expect(
      first
        .getByTestId("target")
        .style.getPropertyValue(HERO_PROGRESS_PROPERTY),
    ).toBe("0.625");
    first.unmount();
    const second = render(<Target />);
    expect(
      second
        .getByTestId("target")
        .style.getPropertyValue(HERO_PROGRESS_PROPERTY),
    ).toBe("0.625");
  });

  it("does not retain or update detached targets", () => {
    const view = render(<Target />);
    const target = view.getByTestId("target");
    view.unmount();
    publishHeroProgress(0.7);
    expect(target.style.getPropertyValue(HERO_PROGRESS_PROPERTY)).toBe("");
  });

  it("deduplicates both writes and events, including clamped endpoints", () => {
    const view = render(<Target />);
    const target = view.getByTestId("target");
    const write = vi.spyOn(target.style, "setProperty");
    const listener = vi.fn();
    window.addEventListener(HERO_PROGRESS_EVENT, listener);
    try {
      publishHeroProgress(0.500_01);
      publishHeroProgress(0.500_02);
      publishHeroProgress(1);
      publishHeroProgress(2);
      expect(write).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(getHeroProgress()).toBe(1);
    } finally {
      window.removeEventListener(HERO_PROGRESS_EVENT, listener);
    }
  });

  it("uses cached geometry on scroll, remeasures on restore, and resets on mobile", () => {
    let scrollTop = 0;
    let documentTop = 100;
    const originalScroll = Object.getOwnPropertyDescriptor(window, "scrollY");
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollTop,
    });
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({ top: documentTop - scrollTop }) as DOMRect);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      () => window.innerHeight + 1000,
    );
    const frames = new Map<number, FrameRequestCallback>();
    let identifier = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++identifier, callback);
      return identifier;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });
    const flush = (): void => {
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) {
          callback(0);
        }
      });
    };
    try {
      const view = render(<Hero enabled />);
      rect.mockClear();
      scrollTop = 600;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      flush();
      expect(getHeroProgress()).toBe(0.5);
      expect(rect).not.toHaveBeenCalled();
      documentTop = 200;
      act(() => {
        window.dispatchEvent(new Event("pageshow"));
      });
      flush();
      expect(getHeroProgress()).toBe(0.4);
      expect(rect).toHaveBeenCalledOnce();
      view.rerender(<Hero enabled={false} />);
      expect(getHeroProgress()).toBe(0);
      expect(
        view
          .getByTestId("target")
          .style.getPropertyValue(HERO_PROGRESS_PROPERTY),
      ).toBe("0");
      expect(frames.size).toBe(0);
    } finally {
      if (originalScroll !== undefined) {
        Object.defineProperty(window, "scrollY", originalScroll);
      }
    }
  });
});
