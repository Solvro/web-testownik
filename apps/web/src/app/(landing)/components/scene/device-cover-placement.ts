"use client";

import { useLayoutEffect } from "react";

import { laptopScreenRect } from "./laptop-framing";

/**
 * Lays the closed-pose cover over exactly the box the camera solver gives
 * the laptop in a container of this size. `DEVICE_COVER_CLASS` holds the
 * server-rendered guess; this replaces it with the solved rectangle, which
 * also depends on the container's aspect (narrow stages are width-limited).
 */
export function placeDeviceCover(
  cover: HTMLElement,
  width: number,
  height: number,
): void {
  const rect = laptopScreenRect(width, height);
  cover.style.left = `${(rect.left + rect.width / 2).toFixed(2)}px`;
  cover.style.top = `${rect.top.toFixed(2)}px`;
  cover.style.width = `${rect.width.toFixed(2)}px`;
  cover.style.height = `${rect.height.toFixed(2)}px`;
}

/**
 * Keeps a cover placed in its parent across resizes. The static hero uses it
 * so its placeholder agrees with the stack's own cover before the stage has
 * even been requested.
 */
export function useDeviceCoverPlacement(
  coverReference: React.RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const cover = coverReference.current;
    const container = cover?.parentElement;
    if (cover == null || container == null) {
      return;
    }
    const place = (): void => {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        placeDeviceCover(cover, width, height);
      }
    };
    const observer = new ResizeObserver(place);
    observer.observe(container);
    place();
    return () => {
      observer.disconnect();
    };
  }, [coverReference]);
}
