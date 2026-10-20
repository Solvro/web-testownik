import { describe, expect, it } from "vitest";

import {
  CONTEXT_RESTORE_MS,
  nextWebGLAvailability,
  tryWebGLContext,
} from "./webgl-availability";

describe("WebGL availability", () => {
  it("accepts a context and handles both browser failure modes", () => {
    const context = {};
    expect(tryWebGLContext(() => context)).toBe(context);
    expect(tryWebGLContext(() => null)).toBeNull();
    expect(
      tryWebGLContext(() => {
        throw new Error("Blocked by browser");
      }),
    ).toBeNull();
  });

  it("keeps a 15-second grace for GPU restoration", () => {
    expect(CONTEXT_RESTORE_MS).toBe(15_000);
  });

  it("allows recovery during the context restoration window", () => {
    const lost = nextWebGLAvailability("available", "lost");
    expect(lost).toBe("lost");
    expect(nextWebGLAvailability(lost, "lost")).toBe("lost");
    const restored = nextWebGLAvailability(lost, "restored");
    expect(restored).toBe("available");
    expect(nextWebGLAvailability(restored, "timeout")).toBe("available");
  });

  it("releases an expired scene but permits recreation on late restoration", () => {
    const expired = nextWebGLAvailability(
      nextWebGLAvailability("available", "lost"),
      "timeout",
    );
    expect(expired).toBe("expired");
    expect(nextWebGLAvailability(expired, "timeout")).toBe("expired");
    expect(nextWebGLAvailability(expired, "lost")).toBe("expired");
    const restored = nextWebGLAvailability(expired, "restored");
    expect(restored).toBe("available");
    expect(nextWebGLAvailability(restored, "lost")).toBe("lost");
  });

  it("never retries a creation failure, even on a restored event", () => {
    const failed = nextWebGLAvailability("available", "failed");
    expect(failed).toBe("unavailable");
    for (const event of ["lost", "restored", "timeout", "failed"] as const) {
      expect(nextWebGLAvailability(failed, event)).toBe("unavailable");
    }
    expect(nextWebGLAvailability("expired", "failed")).toBe("unavailable");
  });

  it("ignores duplicate restoration and stale timeouts on an available scene", () => {
    expect(nextWebGLAvailability("available", "restored")).toBe("available");
    expect(nextWebGLAvailability("available", "timeout")).toBe("available");
  });
});
