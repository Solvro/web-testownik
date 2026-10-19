import { SCREEN_FRAME_SOURCE } from "./screen-frame-protocol";
import type {
  ScreenPointerLeaveMessage,
  ScreenPointerMessage,
  ScreenWheelMessage,
} from "./screen-frame-protocol";

/**
 * Input a device screen hands back to the page around it.
 *
 * A wheel over an iframe stays in that iframe, so once the iPhone's list ended
 * (or over a screen with nothing to scroll) the page did not move. The frame's
 * root therefore never chains natively (`overscroll-behavior: none` on its
 * `html`, see `ScreenFrameDocument`), and every wheel no scroller under the
 * pointer can take is posted to the page instead, which scrolls itself. A wheel
 * is either used inside or forwarded, so nothing scrolls twice.
 *
 * The page also gets no pointer events while the pointer is over a frame, so
 * the frame reports where it is, once per animation frame, for the hero
 * Bubble to follow.
 */

const NOT_SCROLLABLE = 0;
const CAN_SCROLL = 1;
const AT_EDGE = 2;

/** Can `element` itself scroll further by `delta` along one axis? */
function scrollAxis(
  overflow: string,
  position: number,
  size: number,
  client: number,
  delta: number,
): number {
  if (delta === 0 || size - client < 1) {
    return NOT_SCROLLABLE;
  }
  if (overflow !== "auto" && overflow !== "scroll") {
    return NOT_SCROLLABLE;
  }
  const canScroll = delta < 0 ? position > 0.5 : position + client < size - 0.5;
  return canScroll ? CAN_SCROLL : AT_EDGE;
}

/**
 * The innermost scroller the previous wheel passed through, and where it was.
 *
 * With only passive listeners the browser may apply a wheel's scroll before
 * or after the event reaches script, so a scroller found at its edge may
 * have got there with this very event. It counts as stuck only once it sits
 * at the edge without having moved since the previous wheel; that costs at
 * most one event of delay at the edge and never scrolls both the screen and
 * the page with one event.
 */
let lastScroller: Element | null = null;
let lastScrollLeft = 0;
let lastScrollTop = 0;

/**
 * Walks up from the wheel's target to the frame's root and reports, per axis
 * (bit 1 for x, bit 2 for y), whether anything on the way uses the delta.
 * Elements that do not overflow are rejected on their scroll sizes alone, so
 * only an actual scroller costs a computed-style lookup.
 */
function consumedAxes(
  target: EventTarget | null,
  deltaX: number,
  deltaY: number,
): number {
  let consumed = 0;
  let innermost: Element | null = null;
  let element = target instanceof Element ? target : null;
  while (element !== null && consumed !== 3) {
    const overflowsX = element.scrollWidth - element.clientWidth >= 1;
    const overflowsY = element.scrollHeight - element.clientHeight >= 1;
    if (overflowsX || overflowsY) {
      const style = getComputedStyle(element);
      const x =
        (consumed & 1) === 0
          ? scrollAxis(
              style.overflowX,
              element.scrollLeft,
              element.scrollWidth,
              element.clientWidth,
              deltaX,
            )
          : NOT_SCROLLABLE;
      const y =
        (consumed & 2) === 0
          ? scrollAxis(
              style.overflowY,
              element.scrollTop,
              element.scrollHeight,
              element.clientHeight,
              deltaY,
            )
          : NOT_SCROLLABLE;
      if (x !== NOT_SCROLLABLE || y !== NOT_SCROLLABLE) {
        // Only the innermost scroller can have taken this event's scroll
        // before script saw it: the screens' scrollers contain their
        // overscroll, so nothing outside them moves with it.
        const settled =
          innermost !== null ||
          (element === lastScroller &&
            element.scrollLeft === lastScrollLeft &&
            element.scrollTop === lastScrollTop);
        if (x === CAN_SCROLL || (x === AT_EDGE && !settled)) {
          consumed |= 1;
        }
        if (y === CAN_SCROLL || (y === AT_EDGE && !settled)) {
          consumed |= 2;
        }
        innermost ??= element;
      }
    }
    element = element.parentElement;
  }
  lastScroller = innermost;
  if (innermost !== null) {
    lastScrollLeft = innermost.scrollLeft;
    lastScrollTop = innermost.scrollTop;
  }
  return consumed;
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

  const onWheel = (event: WheelEvent): void => {
    // Pinch-zoom arrives as a ctrl-wheel; the browser zooms, nothing scrolls.
    if (event.ctrlKey) {
      return;
    }
    const consumed = consumedAxes(event.target, event.deltaX, event.deltaY);
    const deltaX = (consumed & 1) === 0 ? event.deltaX : 0;
    const deltaY = (consumed & 2) === 0 ? event.deltaY : 0;
    if (deltaX === 0 && deltaY === 0) {
      return;
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

  window.addEventListener("wheel", onWheel, { passive: true });
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
