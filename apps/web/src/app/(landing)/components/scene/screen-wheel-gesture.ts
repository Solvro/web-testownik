/**
 * Per axis, what the screen has for a wheel: nothing, a scroller that is
 * already at its end in the wheel's direction, or one that can still move.
 */
export const AXIS_NONE = 0;
export const AXIS_AT_END = 1;
export const AXIS_CAN_SCROLL = 2;
export type AxisScroller =
  | typeof AXIS_NONE
  | typeof AXIS_AT_END
  | typeof AXIS_CAN_SCROLL;

/** A wheel more than this long after the previous one starts a new gesture. */
export const WHEEL_GESTURE_GAP_MS = 150;

/**
 * Decides, per wheel gesture, which axes stay with a screen scroller (bit 1
 * for x, bit 2 for y) and which go to the page.
 *
 * As with a page's own inner scroller: the decision is made when the gesture
 * starts and held until it ends. A gesture that starts over a scroller with
 * room to move stays with it, also once it reaches its end (the scroller
 * bounces, the page does not move). A gesture that starts over a scroller
 * that is already at its end in that direction goes to the page, and keeps
 * going there even if the page scroll moves a scroller under the pointer.
 * An axis is only released mid-gesture when nothing under the pointer
 * scrolls in it any more.
 */
export function createWheelGestureRouter(gapMs = WHEEL_GESTURE_GAP_MS) {
  let lastAt = Number.NEGATIVE_INFINITY;
  let kept = 0;

  return {
    route(x: AxisScroller, y: AxisScroller, now: number): number {
      if (now - lastAt > gapMs) {
        kept =
          (x === AXIS_CAN_SCROLL ? 1 : 0) | (y === AXIS_CAN_SCROLL ? 2 : 0);
      } else {
        kept &= (x === AXIS_NONE ? 0 : 1) | (y === AXIS_NONE ? 0 : 2);
      }
      lastAt = now;
      return kept;
    },
  };
}
