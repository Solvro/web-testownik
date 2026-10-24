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
 * CanvasUI's droplet lens over the hero header and copy.
 *
 * It refracts its children through html-in-canvas, which re-renders the subtree
 * into a `<canvas layoutsubtree>`. That subtree cannot host a nested WebGL
 * canvas, which is why the device scene is a sibling above this component
 * rather than a child: wrapping the MacBook deleted it and rasterised
 * everything else. Here the Bubble only ever captures flat DOM.
 *
 * The effect needs a real pointer to do anything, so it is skipped entirely on
 * touch devices and whenever reduced motion is requested. It is also skipped
 * wherever html-in-canvas is missing (Safari, Firefox, Chrome without the
 * origin trial) or WebGL2 fails: rather than CanvasUI's fallbacks, the copy
 * then renders as plain DOM with no canvases or listeners. That plain markup
 * is also what the server and the hydration pass render.
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
    // The same two boxes Bubble lays out, so `.lp-bubble-capture > div`
    // still paints the grid.
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
      fallbackOpacity={1}
      size={compact ? 16 : 30}
      trail={compact ? 6 : 24}
    >
      {children}
    </Bubble>
  );
}
