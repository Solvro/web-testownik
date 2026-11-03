import { useSyncExternalStore } from "react";

/** Canvas members added by Chrome's experimental html-in-canvas API. */
type HtmlInCanvasElement = HTMLCanvasElement & {
  onpaint?: (() => void) | null;
  requestPaint?: () => void;
  updateElementGeometry?: (
    element: Element,
    options: { canvasTransform: DOMMatrix },
  ) => void;
};

type HtmlInCanvasContext = CanvasRenderingContext2D & {
  drawElementImage?: (
    element: Element,
    x: number,
    y: number,
  ) => DOMMatrix | null | undefined;
};

function canCapture(
  canvas: HtmlInCanvasElement,
  context: HtmlInCanvasContext | null,
): boolean {
  return (
    typeof context?.drawElementImage === "function" &&
    typeof canvas.requestPaint === "function"
  );
}

let support: boolean | undefined;

/** Whether this document can capture DOM into a canvas. Probed once. */
export function supportsHtmlInCanvas(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  if (support === undefined) {
    const probe: HtmlInCanvasElement = document.createElement("canvas");
    support = canCapture(probe, probe.getContext("2d"));
  }
  return support;
}

function subscribeNever(): () => void {
  return unsubscribeNever;
}

function unsubscribeNever(): void {
  // The probed values never change within a document.
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reads a client-only capability that is fixed for the document. False on the
 * server and during hydration, so the plain markup is what renders first.
 */
export function useClientCapability(getSnapshot: () => boolean): boolean {
  return useSyncExternalStore(subscribeNever, getSnapshot, getServerSnapshot);
}

/**
 * Whether this document can run html-in-canvas (`drawElementImage`): Chrome
 * with the `HTMLInCanvas` origin trial or flag, and nothing else today.
 */
export function useSupportsHtmlInCanvas(): boolean {
  return useClientCapability(supportsHtmlInCanvas);
}

export interface HtmlInCanvasCapture {
  /** Draw the content into the source canvas and align its hit-testing. */
  draw: () => void;
  /** Clear the source canvas. */
  reset: () => void;
  /** Ask the browser for a paint event on the next frame. */
  requestPaint: () => void;
  /** Run `listener` whenever the captured subtree repaints. */
  setOnPaint: (listener: (() => void) | null) => void;
}

/**
 * Prepares `source` to capture `content`, or returns null when the browser
 * cannot. Handles both generations of the experimental API.
 */
export function createHtmlInCanvasCapture(
  source: HTMLCanvasElement,
  content: HTMLElement,
): HtmlInCanvasCapture | null {
  const canvas: HtmlInCanvasElement = source;
  const context: HtmlInCanvasContext | null = source.getContext("2d");
  if (
    context === null ||
    typeof context.drawElementImage !== "function" ||
    typeof canvas.requestPaint !== "function"
  ) {
    return null;
  }
  const drawElementImage = context.drawElementImage.bind(context);
  const requestPaint = canvas.requestPaint.bind(canvas);

  if ("content" in source) {
    source.setAttribute("content", "drawable");
    content.setAttribute("drawable", "");
  } else {
    source.setAttribute("layoutsubtree", "");
  }

  return {
    draw() {
      const transform = drawElementImage(content, 0, 0);
      // Chrome 154 decoupled geometry from drawing before enabling automatic
      // 2D synchronization. Older versions have no update method; newer
      // versions synchronize automatically and return nothing. Use the
      // returned matrix as-is: it already accounts for the pixel density.
      if (
        transform instanceof DOMMatrix &&
        typeof canvas.updateElementGeometry === "function"
      ) {
        canvas.updateElementGeometry(content, { canvasTransform: transform });
      }
    },
    reset() {
      context.reset();
    },
    requestPaint,
    setOnPaint(listener) {
      canvas.onpaint = listener;
    },
  };
}
