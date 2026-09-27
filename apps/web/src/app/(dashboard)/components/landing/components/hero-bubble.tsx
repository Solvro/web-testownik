"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { Bubble } from "@/components/canvasui/canvas-bubble";

import {
  useHasFinePointer,
  usePrefersReducedMotion,
} from "../hooks/use-prefers-reduced-motion";
import {
  getSatelliteHovered,
  subscribeSatelliteHover,
} from "../satellite-hover";

/**
 * CanvasUI's droplet lens over the hero header and copy.
 *
 * It refracts its children through html-in-canvas, which re-renders the subtree
 * into a `<canvas layoutsubtree>`. That subtree cannot host a nested WebGL
 * canvas, which is why the device scene is a sibling above this component
 * rather than a child: wrapping the MacBook deleted it and rasterised
 * everything else. Here the Bubble only ever captures flat DOM.
 *
 * The effect needs a real pointer to do anything, so it is skipped entirely on
 * touch devices and whenever reduced motion is requested.
 */
export function HeroBubble({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  const hasFinePointer = useHasFinePointer();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isEnabled = hasFinePointer && !prefersReducedMotion;
  const compact = useSyncExternalStore(
    subscribeSatelliteHover,
    getSatelliteHovered,
    () => false,
  );

  return (
    <Bubble
      enabled={isEnabled}
      className={className}
      fallbackOpacity={1}
      size={compact ? 16 : 30}
      trail={compact ? 6 : 24}
    >
      {children}
    </Bubble>
  );
}
