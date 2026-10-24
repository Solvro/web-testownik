import { SCREEN_FRAME_SOURCE } from "./screen-frame-protocol";
import type {
  ScreenPointerLeaveMessage,
  ScreenPointerMessage,
  ScreenWheelMessage,
} from "./screen-frame-protocol";
import {
  AXIS_AT_END,
  AXIS_CAN_SCROLL,
  AXIS_NONE,
  createWheelGestureRouter,
} from "./screen-wheel-gesture";
import type { AxisScroller } from "./screen-wheel-gesture";

/**
 * Input a device screen hands back to the page around it.
 *
 * A wheel over an iframe stays in that iframe, so over a screen with nothing to
 * scroll the page did not move. Every wheel over a part of the screen that has
 * no scroller at all in that axis is therefore posted to the page, which
 * scrolls itself.
 *
 * A wheel gesture over a scroller stays with it for as long as it lasts,
 * also once it has reached its end, as a scroll gesture over a page's inner
 * scroller does: the scroller bounces at its edge (its `overscroll-behavior`
 * is left at `auto`) and the page does not start moving underneath. The next
 * gesture, started while the scroller is already at its end in that
 * direction, goes to the page instead (`screen-wheel-gesture.ts`). The
 * frame's root does not chain natively either (`overscroll-behavior: none`
 * on its `html`, see `ScreenFrameDocument`), so a wheel is either used inside
 * or forwarded, never both.
 *
 * The page also gets no pointer events while the pointer is over a frame, so
 * the frame reports where it is, once per animation frame, for the hero
 * Bubble to follow.
 */

/** Is `overflow` a user-scrollable value? `hidden` and `clip` are not. */
function isScrollable(overflow: string): boolean {
  return overflow === "auto" || overflow === "scroll";
}

/** Can `element` still scroll in this axis towards `delta`? Unknown direction counts. */
function hasRoom(
  delta: number,
  position: number,
  scrollSize: number,
  clientSize: number,
): boolean {
  if (delta > 0) {
    return position < scrollSize - clientSize - 1;
  }
  return delta === 0 || position > 0;
}

/**
 * Walks up from the wheel's target to the frame's root and reports, per axis,
 * the best scroller on the way: one with room in the wheel's direction beats
 * one at its end, which beats none. Elements that do not overflow are
 * rejected on their scroll sizes alone, so only an actual scroller costs a
 * computed-style lookup.
 */
function findScrollers(
  target: EventTarget | null,
  deltaX: number,
  deltaY: number,
): [AxisScroller, AxisScroller] {
  let x: AxisScroller = AXIS_NONE;
  let y: AxisScroller = AXIS_NONE;
  let element = target instanceof Element ? target : null;
  while (element !== null && (x !== AXIS_CAN_SCROLL || y !== AXIS_CAN_SCROLL)) {
    const overflowsX = element.scrollWidth - element.clientWidth >= 1;
    const overflowsY = element.scrollHeight - element.clientHeight >= 1;
    if (overflowsX || overflowsY) {
      const style = getComputedStyle(element);
      if (overflowsX && isScrollable(style.overflowX)) {
        x = Math.max(
          x,
          hasRoom(
            deltaX,
            element.scrollLeft,
            element.scrollWidth,
            element.clientWidth,
          )
            ? AXIS_CAN_SCROLL
            : AXIS_AT_END,
        ) as AxisScroller;
      }
      if (overflowsY && isScrollable(style.overflowY)) {
        y = Math.max(
          y,
          hasRoom(
            deltaY,
            element.scrollTop,
            element.scrollHeight,
            element.clientHeight,
          )
            ? AXIS_CAN_SCROLL
            : AXIS_AT_END,
        ) as AxisScroller;
      }
    }
    element = element.parentElement;
  }
  return [x, y];
}

/**
 * Starts forwarding wheel and pointer input to `window.parent`. Returns the
 * cleanup. One message object of each kind is reused; `postMessage` clones it.
 */
export function forwardScreenInput(): () => void {
  const parent = window.parent;
  const origin = window.location.origin;

  const wheel: ScreenWheelMessage = {
    source: SCREEN_FRAME_SOURCE,
    type: "wheel",
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
  };
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

  const gestures = createWheelGestureRouter();
  const onWheel = (event: WheelEvent): void => {
    // Pinch-zoom arrives as a ctrl-wheel; the browser zooms, nothing scrolls.
    if (event.ctrlKey) {
      return;
    }
    const [x, y] = findScrollers(event.target, event.deltaX, event.deltaY);
    const kept = gestures.route(x, y, event.timeStamp);
    const deltaX = (kept & 1) === 0 ? event.deltaX : 0;
    const deltaY = (kept & 2) === 0 ? event.deltaY : 0;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }
    // A page-owned gesture that reverses over the scroller it started at
    // the end of would also move that scroller natively; only the page may.
    if (
      (deltaX !== 0 && x === AXIS_CAN_SCROLL) ||
      (deltaY !== 0 && y === AXIS_CAN_SCROLL)
    ) {
      event.preventDefault();
    }
    wheel.deltaX = deltaX;
    wheel.deltaY = deltaY;
    wheel.deltaMode = event.deltaMode;
    parent.postMessage(wheel, origin);
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

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerout", onPointerOut, { passive: true });

  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerout", onPointerOut);
    if (pointerFrame !== 0) {
      cancelAnimationFrame(pointerFrame);
    }
  };
}
