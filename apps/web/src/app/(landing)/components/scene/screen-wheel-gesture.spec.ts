import { describe, expect, it } from "vitest";

import {
  AXIS_AT_END,
  AXIS_CAN_SCROLL,
  AXIS_NONE,
  createWheelGestureRouter,
} from "./screen-wheel-gesture";

describe("wheel gesture routing inside a device screen", () => {
  it("keeps a gesture with the scroller it started on, also at its end", () => {
    const router = createWheelGestureRouter();
    expect(router.route(AXIS_NONE, AXIS_CAN_SCROLL, 0)).toBe(2);
    expect(router.route(AXIS_NONE, AXIS_CAN_SCROLL, 16)).toBe(2);
    // The list reached its bottom; the same gesture bounces, the page waits.
    expect(router.route(AXIS_NONE, AXIS_AT_END, 32)).toBe(2);
    expect(router.route(AXIS_NONE, AXIS_AT_END, 48)).toBe(2);
  });

  it("hands the next gesture at the end of a scroller to the page", () => {
    const router = createWheelGestureRouter();
    router.route(AXIS_NONE, AXIS_CAN_SCROLL, 0);
    router.route(AXIS_NONE, AXIS_AT_END, 16);
    expect(router.route(AXIS_NONE, AXIS_AT_END, 400)).toBe(0);
    // Still the page while the gesture lasts, whatever slid under the pointer.
    expect(router.route(AXIS_NONE, AXIS_CAN_SCROLL, 416)).toBe(0);
  });

  it("scrolls the list again when the next gesture reverses", () => {
    const router = createWheelGestureRouter();
    router.route(AXIS_NONE, AXIS_AT_END, 0);
    expect(router.route(AXIS_NONE, AXIS_CAN_SCROLL, 400)).toBe(2);
  });

  it("forwards an axis nothing under the pointer scrolls", () => {
    const router = createWheelGestureRouter();
    expect(router.route(AXIS_NONE, AXIS_NONE, 0)).toBe(0);
    expect(router.route(AXIS_CAN_SCROLL, AXIS_NONE, 400)).toBe(1);
  });

  it("releases an axis mid-gesture once no scroller is left in it", () => {
    const router = createWheelGestureRouter();
    expect(router.route(AXIS_CAN_SCROLL, AXIS_CAN_SCROLL, 0)).toBe(3);
    expect(router.route(AXIS_NONE, AXIS_AT_END, 16)).toBe(2);
    // A released axis is not taken back within the gesture.
    expect(router.route(AXIS_CAN_SCROLL, AXIS_CAN_SCROLL, 32)).toBe(2);
  });

  it("treats a wheel after the gap as a new gesture", () => {
    const router = createWheelGestureRouter(100);
    router.route(AXIS_NONE, AXIS_CAN_SCROLL, 0);
    expect(router.route(AXIS_NONE, AXIS_AT_END, 100)).toBe(2);
    expect(router.route(AXIS_NONE, AXIS_AT_END, 201)).toBe(0);
  });
});
