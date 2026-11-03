import { SCREEN_FRAME_SOURCE } from "./screen-frame-protocol";
import type {
  ScreenPointerLeaveMessage,
  ScreenPointerMessage,
} from "./screen-frame-protocol";

// The page gets no pointer events over a frame, so the frame reports the
// pointer for the hero Bubble to follow. Wheel chaining needs no help.

/** One message object of each kind is reused; `postMessage` clones it. */
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
