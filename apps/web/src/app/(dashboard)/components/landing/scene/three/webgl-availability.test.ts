import { describe, expect, it } from "vitest";

import {
  CONTEXT_RESTORE_MS,
  createWebGLRetryPolicy,
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

  it("keeps a failed scene terminal, even on a restored event", () => {
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

describe("desktop WebGL retries", () => {
  it("allows one remount retry after failure and warns only once per page", () => {
    const policy = createWebGLRetryPolicy();
    expect(policy.canAttempt()).toBe(true);
    expect(policy.recordFailure("creation-failed")).toBe(true);
    expect(policy.canAttempt()).toBe(true);
    expect(policy.recordFailure("creation-failed")).toBe(false);
    for (let remount = 0; remount < 5; remount += 1) {
      expect(policy.canAttempt()).toBe(false);
      expect(policy.recordFailure("creation-failed")).toBe(false);
    }
    expect(createWebGLRetryPolicy().canAttempt()).toBe(true);
  });

  it("does not spend creation retries on GPU context restoration timeouts", () => {
    const policy = createWebGLRetryPolicy();
    expect(policy.recordFailure("context-timeout")).toBe(true);
    expect(policy.recordFailure("context-timeout")).toBe(false);
    expect(policy.canAttempt()).toBe(true);
  });
});
