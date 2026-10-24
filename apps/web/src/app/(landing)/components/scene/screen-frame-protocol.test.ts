import { describe, expect, it } from "vitest";

import {
  SCREEN_FRAME_SOURCE,
  createScreenChannelName,
  isScreenChannelName,
  parseScreenFrameMessage,
  parseScreenFrameRequest,
  screenFrameUrl,
  wheelDeltaToPixels,
} from "./screen-frame-protocol";

describe("wheelDeltaToPixels", () => {
  it("passes pixels through and scales lines and pages", () => {
    expect(wheelDeltaToPixels(-53.5, 0, 900)).toBe(-53.5);
    expect(wheelDeltaToPixels(3, 1, 900)).toBe(120);
    expect(wheelDeltaToPixels(-1, 2, 800)).toBe(-700);
  });
});

describe("parseScreenFrameRequest", () => {
  it.each(["laptop", "tablet", "phone"] as const)("accepts %s", (device) => {
    expect(
      parseScreenFrameRequest(device, { theme: "dark", channel: "lp-abc_1" }),
    ).toEqual({ device, theme: "dark", channel: "lp-abc_1" });
  });

  it.each(["watch", "", "Laptop", "laptop/../phone", "constructor"])(
    "rejects the device %j",
    (device) => {
      expect(parseScreenFrameRequest(device, {})).toBeNull();
    },
  );

  it("falls back to light and no channel", () => {
    expect(parseScreenFrameRequest("phone", {})).toEqual({
      device: "phone",
      theme: "light",
      channel: undefined,
    });
    expect(
      parseScreenFrameRequest("phone", {
        theme: "sepia",
        channel: "no spaces/allowed",
      }),
    ).toEqual({ device: "phone", theme: "light", channel: undefined });
    expect(
      parseScreenFrameRequest("phone", { channel: "x".repeat(65) })?.channel,
    ).toBeUndefined();
  });

  it("takes the first of repeated parameters", () => {
    expect(
      parseScreenFrameRequest("laptop", {
        theme: ["dark", "light"],
        channel: ["one", "two"],
      }),
    ).toEqual({ device: "laptop", theme: "dark", channel: "one" });
  });

  it("round-trips the URL it builds", () => {
    const request = {
      device: "phone",
      theme: "dark",
      channel: createScreenChannelName(),
    } as const;
    const url = new URL(screenFrameUrl(request), "https://example.test");
    const device = url.pathname.split("/")[2];
    expect(
      parseScreenFrameRequest(device, Object.fromEntries(url.searchParams)),
    ).toEqual(request);
    expect(
      screenFrameUrl({ device: "tablet", theme: "light", channel: undefined }),
    ).toBe("/landing-screen/tablet?theme=light");
  });
});

describe("createScreenChannelName", () => {
  it("makes valid, distinct names", () => {
    const first = createScreenChannelName();
    expect(isScreenChannelName(first)).toBe(true);
    expect(createScreenChannelName()).not.toBe(first);
  });
});

describe("parseScreenFrameMessage", () => {
  it("accepts the theme and ready messages", () => {
    expect(
      parseScreenFrameMessage({
        source: SCREEN_FRAME_SOURCE,
        type: "theme",
        theme: "dark",
      }),
    ).toEqual({ source: SCREEN_FRAME_SOURCE, type: "theme", theme: "dark" });
    expect(
      parseScreenFrameMessage({
        source: SCREEN_FRAME_SOURCE,
        type: "ready",
        device: "tablet",
      }),
    ).toEqual({ source: SCREEN_FRAME_SOURCE, type: "ready", device: "tablet" });
  });

  it("accepts the wheel and pointer messages", () => {
    const wheel = {
      source: SCREEN_FRAME_SOURCE,
      type: "wheel",
      deltaX: 0,
      deltaY: -120,
      deltaMode: 1,
    };
    expect(parseScreenFrameMessage(wheel)).toEqual(wheel);
    const pointer = {
      source: SCREEN_FRAME_SOURCE,
      type: "pointer",
      clientX: 12.5,
      clientY: 400,
    };
    expect(parseScreenFrameMessage(pointer)).toEqual(pointer);
    expect(
      parseScreenFrameMessage({
        source: SCREEN_FRAME_SOURCE,
        type: "pointerleave",
      }),
    ).toEqual({ source: SCREEN_FRAME_SOURCE, type: "pointerleave" });
  });

  it.each([
    null,
    "ready",
    { source: SCREEN_FRAME_SOURCE, type: "wheel", deltaX: 0, deltaY: 10 },
    {
      source: SCREEN_FRAME_SOURCE,
      type: "wheel",
      deltaX: 0,
      deltaY: Number.NaN,
      deltaMode: 0,
    },
    {
      source: SCREEN_FRAME_SOURCE,
      type: "wheel",
      deltaX: "1",
      deltaY: 10,
      deltaMode: 0,
    },
    {
      source: SCREEN_FRAME_SOURCE,
      type: "wheel",
      deltaX: 0,
      deltaY: 10,
      deltaMode: 3,
    },
    { source: SCREEN_FRAME_SOURCE, type: "pointer", clientX: 1 },
    {
      source: SCREEN_FRAME_SOURCE,
      type: "pointer",
      clientX: Number.POSITIVE_INFINITY,
      clientY: 1,
    },
    { type: "pointerleave" },
    { type: "ready", device: "phone" },
    { source: SCREEN_FRAME_SOURCE, type: "ready", device: "watch" },
    { source: SCREEN_FRAME_SOURCE, type: "theme", theme: "sepia" },
    { source: SCREEN_FRAME_SOURCE, type: "navigate" },
  ])("rejects %j", (data) => {
    expect(parseScreenFrameMessage(data)).toBeNull();
  });
});
