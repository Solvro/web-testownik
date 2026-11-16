import { beforeEach, expect, it, vi } from "vitest";
import { createCompletionAnnouncement } from "../src/lib/accessibility-feedback";

const mocks = vi.hoisted(() => ({
  platform: { OS: "ios" },
  queued: vi.fn(),
  plain: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: mocks.platform,
  AccessibilityInfo: {
    announceForAccessibilityWithOptions: mocks.queued,
    announceForAccessibility: mocks.plain,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.OS = "ios";
});

it("queues one iOS completion without interrupting current speech", () => {
  const announce = createCompletionAnnouncement();
  announce("Reply ready");
  announce("Reply ready");
  expect(mocks.queued).toHaveBeenCalledExactlyOnceWith("Reply ready", {
    queue: true,
  });
  expect(mocks.plain).not.toHaveBeenCalled();
});

it("uses Android's announcement API once per request", () => {
  mocks.platform.OS = "android";
  const announce = createCompletionAnnouncement();
  announce("Hint ready");
  announce("Hint ready");
  expect(mocks.plain).toHaveBeenCalledExactlyOnceWith("Hint ready");
  expect(mocks.queued).not.toHaveBeenCalled();
});

it("leaves web live-region announcements to the browser", () => {
  mocks.platform.OS = "web";
  createCompletionAnnouncement()("Correct!");
  expect(mocks.queued).not.toHaveBeenCalled();
  expect(mocks.plain).not.toHaveBeenCalled();
});

it("suppresses a result completed after cancellation or scope cleanup", () => {
  const controller = new AbortController();
  const announce = createCompletionAnnouncement(controller.signal);
  controller.abort();
  announce("Explanation ready");
  expect(mocks.queued).not.toHaveBeenCalled();
  expect(mocks.plain).not.toHaveBeenCalled();
});

it("ignores empty results without consuming the request's completion", () => {
  const announce = createCompletionAnnouncement();
  announce(" \n");
  expect(mocks.queued).not.toHaveBeenCalled();
  announce("Reply ready");
  expect(mocks.queued).toHaveBeenCalledTimes(1);
});

it("a replacement request can announce while the disposed request stays silent", () => {
  const previous = new AbortController();
  const stale = createCompletionAnnouncement(previous.signal);
  previous.abort();
  const current = createCompletionAnnouncement(new AbortController().signal);
  stale("Hint ready");
  current("Hint ready");
  expect(mocks.queued).toHaveBeenCalledTimes(1);
});
