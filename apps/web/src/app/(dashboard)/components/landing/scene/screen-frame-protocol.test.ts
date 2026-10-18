import { describe, expect, it } from "vitest";

import {
  SCREEN_FRAME_SOURCE,
  createScreenChannelName,
  isScreenChannelName,
  parseScreenFrameMessage,
  parseScreenFrameRequest,
  screenFrameUrl,
} from "./screen-frame-protocol";

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
  it("accepts the two messages", () => {
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

  it.each([
    null,
    "ready",
    { type: "ready", device: "phone" },
    { source: SCREEN_FRAME_SOURCE, type: "ready", device: "watch" },
    { source: SCREEN_FRAME_SOURCE, type: "theme", theme: "sepia" },
    { source: SCREEN_FRAME_SOURCE, type: "navigate" },
  ])("rejects %j", (data) => {
    expect(parseScreenFrameMessage(data)).toBeNull();
  });
});
