import { describe, expect, it } from "vitest";

import { nextWebGLAvailability, tryWebGLContext } from "./webgl-availability";

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

  it("allows recovery during the context restoration window", () => {
    const lost = nextWebGLAvailability("available", "lost");
    expect(lost).toBe("lost");
    const restored = nextWebGLAvailability(lost, "restored");
    expect(restored).toBe("available");
    expect(nextWebGLAvailability(restored, "timeout")).toBe("available");
  });

  it("makes an unrecovered context terminal, even if restore arrives late", () => {
    const failed = nextWebGLAvailability(
      nextWebGLAvailability("available", "lost"),
      "timeout",
    );
    expect(failed).toBe("unavailable");
    for (const event of ["lost", "restored", "timeout"] as const) {
      expect(nextWebGLAvailability(failed, event)).toBe("unavailable");
    }
  });
});
