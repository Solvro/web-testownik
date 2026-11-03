"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";

import { Bubble } from "@/app/(landing)/canvasui/canvas-bubble";

import { useSupportsHtmlInCanvas } from "../hooks/use-html-in-canvas";
import {
  useHasFinePointer,
  usePrefersReducedMotion,
} from "../hooks/use-prefers-reduced-motion";
import {
  getSatelliteHovered,
  subscribeSatelliteHover,
} from "../satellite-hover";

/**
 * CanvasUI's droplet lens over the hero header and copy. html-in-canvas cannot
 * host a nested WebGL canvas, so the device scene is a sibling above it.
 *
 * Without a fine pointer, with reduced motion, without html-in-canvas or when
 * WebGL2 fails, the copy renders as plain DOM instead of CanvasUI's fallbacks.
 */
export function HeroBubble({
  children,
  className,
  onRender,
}: {
  children: ReactNode;
  className?: string;
  /** After each droplet frame, with the output canvas still readable. */
  onRender?: (output: HTMLCanvasElement) => void;
}): React.JSX.Element {
  const hasFinePointer = useHasFinePointer();
  const prefersReducedMotion = usePrefersReducedMotion();
  const supportsHtmlInCanvas = useSupportsHtmlInCanvas();
  const [isUnavailable, setIsUnavailable] = useState(false);
  const isEnabled =
    hasFinePointer &&
    !prefersReducedMotion &&
    supportsHtmlInCanvas &&
    !isUnavailable;
  const compact = useSyncExternalStore(
    subscribeSatelliteHover,
    getSatelliteHovered,
    () => false,
  );

  if (!isEnabled) {
    // The same two boxes Bubble lays out, so `.lp-bubble-capture > div` paints
    // the grid.
    return (
      <div className={className} style={{ position: "relative" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <Bubble
      onUnavailable={() => {
        setIsUnavailable(true);
      }}
      className={className}
      onRender={onRender}
      fallbackOpacity={1}
      size={compact ? 16 : 30}
      trail={compact ? 6 : 24}
    >
      {children}
    </Bubble>
  );
}
