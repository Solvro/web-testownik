"use client";

import { useLayoutEffect } from "react";

import { laptopScreenRect } from "./laptop-framing";

/** Replaces `DEVICE_COVER_CLASS`'s server-rendered guess with the solved box. */
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
