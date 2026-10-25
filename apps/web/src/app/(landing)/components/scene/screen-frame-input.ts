import { SCREEN_FRAME_SOURCE } from "./screen-frame-protocol";
import type {
  ScreenPointerLeaveMessage,
  ScreenPointerMessage,
} from "./screen-frame-protocol";

/**
 * Pointer positions a device screen hands back to the page around it.
 *
 * Wheel input needs nothing of the kind: the browser scrolls a screen's own
 * scroller while a gesture stays on it and chains the rest to the page, as
 * for any iframe. The page gets no pointer events while the pointer is over
 * a frame, though, so the frame reports where it is, once per animation
 * frame, for the hero Bubble to follow.
 */

/**
 * Starts forwarding the pointer to `window.parent`. Returns the cleanup. One
 * message object of each kind is reused; `postMessage` clones it.
 */
export function forwardScreenInput(): () => void {
  const parent = window.parent;
  const origin = window.location.origin;

  const pointer: ScreenPointerMessage = {
    source: SCREEN_FRAME_SOURCE,
    type: "pointer",
    clientX: 0,
    clientY: 0,
  };
  const leave: ScreenPointerLeaveMessage = {
    source: SCREEN_FRAME_SOURCE,
    type: "pointerleave",
  };

  let pointerFrame = 0;
  const postPointer = (): void => {
    pointerFrame = 0;
    parent.postMessage(pointer, origin);
  };
  const onPointerMove = (event: PointerEvent): void => {
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    if (pointerFrame === 0) {
      pointerFrame = requestAnimationFrame(postPointer);
    }
  };
  // A pointer leaving the document has no related target in it.
  const onPointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget !== null) {
      return;
    }
    if (pointerFrame !== 0) {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
    }
    parent.postMessage(leave, origin);
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerout", onPointerOut, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerout", onPointerOut);
    if (pointerFrame !== 0) {
      cancelAnimationFrame(pointerFrame);
    }
  };
}
