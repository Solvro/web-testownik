/**
 * The contract between the desktop hero and its device-screen iframes.
 *
 * Each live screen of the 3D stack is its own document at
 * `/landing-screen/<device>`, laid out at the screen's native CSS size (see
 * `SCREEN_PLACEMENT`), so breakpoints, dialogs and Floating UI measure the
 * device rather than the visitor's monitor and the CSS3D perspective. The
 * page passes everything a screen needs in the URL; afterwards the two sides
 * talk only through the `postMessage` messages below, same origin only.
 */

export const SCREEN_DEVICES = ["laptop", "tablet", "phone"] as const;
export type ScreenDevice = (typeof SCREEN_DEVICES)[number];

export type ScreenTheme = "light" | "dark";

export const SCREEN_FRAME_PATH = "/landing-screen";

export interface ScreenFrameRequest {
  device: ScreenDevice;
  theme: ScreenTheme;
  /**
   * The `BroadcastChannel` the laptop and the iPhone share their quiz over.
   * Unique per page load, so two open landing tabs do not drive each other.
   */
  channel: string | undefined;
}

/** Channel names come from the page URL; keep them boring. */
const CHANNEL_NAME = /^[\w-]{1,64}$/;

export function isScreenChannelName(value: unknown): value is string {
  return typeof value === "string" && CHANNEL_NAME.test(value);
}

type SearchValue = string | string[] | undefined;

function single(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isScreenDevice(value: unknown): value is ScreenDevice {
  return (
    typeof value === "string" &&
    (SCREEN_DEVICES as readonly string[]).includes(value)
  );
}

/**
 * Validates the route's params. An unknown device is a 404; a missing or
 * malformed theme or channel falls back to light and an unsynced quiz.
 */
export function parseScreenFrameRequest(
  device: string,
  search: { theme?: SearchValue; channel?: SearchValue },
): ScreenFrameRequest | null {
  if (!isScreenDevice(device)) {
    return null;
  }
  const channel = single(search.channel);
  return {
    device,
    theme: single(search.theme) === "dark" ? "dark" : "light",
    channel: isScreenChannelName(channel) ? channel : undefined,
  };
}

export function screenFrameUrl({
  device,
  theme,
  channel,
}: ScreenFrameRequest): string {
  const search = new URLSearchParams({ theme });
  if (channel !== undefined) {
    search.set("channel", channel);
  }
  return `${SCREEN_FRAME_PATH}/${device}?${search.toString()}`;
}

export const SCREEN_FRAME_SOURCE = "testownik-landing-screen";

/** Page → frame: the page's theme changed. */
export interface ScreenThemeMessage {
  source: typeof SCREEN_FRAME_SOURCE;
  type: "theme";
  theme: ScreenTheme;
}

/** Frame → page: the screen has painted its first frame and can be shown. */
export interface ScreenReadyMessage {
  source: typeof SCREEN_FRAME_SOURCE;
  type: "ready";
  device: ScreenDevice;
}

/**
 * Frame → page: a wheel the screen could not use. Sent only when no scroller
 * under the pointer can move further that way, so the page scrolls instead
 * and nothing scrolls twice. Deltas are the event's own, in `deltaMode` units.
 */
export interface ScreenWheelMessage {
  source: typeof SCREEN_FRAME_SOURCE;
  type: "wheel";
  deltaX: number;
  deltaY: number;
  /** `WheelEvent.DOM_DELTA_PIXEL` (0), `_LINE` (1) or `_PAGE` (2). */
  deltaMode: number;
}

/**
 * Frame → page: where the pointer is on the screen, in the frame's own CSS
 * pixels (at most one per animation frame), so the hero Bubble can follow it
 * across the device. `pointerleave` once it leaves the frame's document.
 */
export interface ScreenPointerMessage {
  source: typeof SCREEN_FRAME_SOURCE;
  type: "pointer";
  clientX: number;
  clientY: number;
}

export interface ScreenPointerLeaveMessage {
  source: typeof SCREEN_FRAME_SOURCE;
  type: "pointerleave";
}

export type ScreenFrameMessage =
  | ScreenThemeMessage
  | ScreenReadyMessage
  | ScreenWheelMessage
  | ScreenPointerMessage
  | ScreenPointerLeaveMessage;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseScreenFrameMessage(
  data: unknown,
): ScreenFrameMessage | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const message = data as Record<string, unknown>;
  if (message.source !== SCREEN_FRAME_SOURCE) {
    return null;
  }
  if (
    message.type === "theme" &&
    (message.theme === "light" || message.theme === "dark")
  ) {
    return message as unknown as ScreenThemeMessage;
  }
  if (message.type === "ready" && isScreenDevice(message.device)) {
    return message as unknown as ScreenReadyMessage;
  }
  if (
    message.type === "wheel" &&
    isFiniteNumber(message.deltaX) &&
    isFiniteNumber(message.deltaY) &&
    (message.deltaMode === 0 ||
      message.deltaMode === 1 ||
      message.deltaMode === 2)
  ) {
    return message as unknown as ScreenWheelMessage;
  }
  if (
    message.type === "pointer" &&
    isFiniteNumber(message.clientX) &&
    isFiniteNumber(message.clientY)
  ) {
    return message as unknown as ScreenPointerMessage;
  }
  if (message.type === "pointerleave") {
    return message as unknown as ScreenPointerLeaveMessage;
  }
  return null;
}

/** What one wheel "line" scrolls, as Chrome and Firefox do for the page. */
const WHEEL_LINE_PX = 40;

/**
 * Converts a forwarded wheel delta to CSS pixels. Lines are browser-defined;
 * a page is the scrolled viewport less a little overlap, as the browsers'
 * own page scrolling does.
 */
export function wheelDeltaToPixels(
  delta: number,
  deltaMode: number,
  pageSize: number,
): number {
  if (deltaMode === 1) {
    return delta * WHEEL_LINE_PX;
  }
  if (deltaMode === 2) {
    return delta * Math.max(pageSize * 0.875, 1);
  }
  return delta;
}

/** A fresh channel name per page load. */
export function createScreenChannelName(): string {
  return `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
