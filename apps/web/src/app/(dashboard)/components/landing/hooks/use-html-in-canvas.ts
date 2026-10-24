import { useSyncExternalStore } from "react";

import { supportsHtmlInCanvas } from "@/components/canvasui/canvas-bubble";

let supported: boolean | undefined;

function getSupport(): boolean {
  // Probing creates a canvas, so answer once per document.
  supported ??= supportsHtmlInCanvas();
  return supported;
}

function getServerSupport(): boolean {
  return false;
}

function unsubscribe(): void {
  // Support never changes within a document; nothing to tear down.
}

function subscribe(): () => void {
  return unsubscribe;
}

/**
 * Whether this document can run html-in-canvas (`drawElementImage`), which the
 * Bubble and Glass lenses depend on: Chrome with the `HTMLInCanvas` origin
 * trial or flag, and nothing else today. False on the server and during
 * hydration, so the plain children are what both render first.
 */
export function useSupportsHtmlInCanvas(): boolean {
  return useSyncExternalStore(subscribe, getSupport, getServerSupport);
}
