// The page passes everything a device screen needs in its URL; afterwards the
// two talk only through these same-origin `postMessage` messages.

export const SCREEN_DEVICES = ["laptop", "tablet", "phone"] as const;
export type ScreenDevice = (typeof SCREEN_DEVICES)[number];

export type ScreenTheme = "light" | "dark";

export const SCREEN_FRAME_PATH = "/landing-screen";

export interface ScreenFrameRequest {
  device: ScreenDevice;
  theme: ScreenTheme;
  /** Unique per page load, so two open landing tabs do not drive each other. */
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

/** An unknown device is a 404; a bad theme or channel falls back to defaults. */
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

/** Frame → page: the pointer in the frame's CSS pixels, at most once per frame. */
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

export function createScreenChannelName(): string {
  return `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
