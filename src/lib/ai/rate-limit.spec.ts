import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  createRateLimitHeaders,
  resetRateLimitStore,
} from "./rate-limit";

vi.mock("server-only", () => ({}));

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    resetRateLimitStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the configured limit", () => {
    const options = { limit: 2, window: 60 };

    expect(checkRateLimit("user-1", "ai-chat", options)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit("user-1", "ai-chat", options)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("blocks requests after the configured limit", () => {
    const options = { limit: 2, window: 60 };

    checkRateLimit("user-1", "ai-chat", options);
    checkRateLimit("user-1", "ai-chat", options);

    expect(checkRateLimit("user-1", "ai-chat", options)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfter: 60,
    });
  });

  it("tracks users and scopes independently", () => {
    const options = { limit: 1, window: 60 };

    checkRateLimit("user-1", "ai-chat", options);

    expect(checkRateLimit("user-2", "ai-chat", options).allowed).toBe(true);
    expect(checkRateLimit("user-1", "ai-explain", options).allowed).toBe(true);
  });

  it("allows new requests after the window expires", () => {
    const options = { limit: 1, window: 60 };

    checkRateLimit("user-1", "ai-chat", options);
    vi.advanceTimersByTime(60_000);

    expect(checkRateLimit("user-1", "ai-chat", options)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("creates standard rate limit headers", () => {
    const result = checkRateLimit("user-1", "ai-chat", {
      limit: 2,
      window: 60,
    });

    expect(createRateLimitHeaders(result)).toEqual({
      "X-RateLimit-Limit": "2",
      "X-RateLimit-Remaining": "1",
    });
  });
});
