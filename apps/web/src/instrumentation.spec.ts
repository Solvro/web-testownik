import { afterEach, describe, expect, it, vi } from "vitest";

import { register } from "./instrumentation";

const warm = vi.hoisted(() => vi.fn());
vi.mock("@/app/(landing)/lib/landing-demo-tokenizer.server", () => ({
  warmLandingDemoTokenizer: warm,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  warm.mockReset();
});

describe("tokenizer startup", () => {
  it("returns before the Node production warm-up completes", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");
    warm.mockReturnValue(
      new Promise<void>(() => {
        // Deliberately pending: startup must not wait for the encoder.
      }),
    );

    register();
    await vi.waitFor(() => {
      expect(warm).toHaveBeenCalledOnce();
    });
  });

  it.each([
    ["edge", "production"],
    ["nodejs", "development"],
    ["nodejs", "test"],
  ])("skips warm-up in %s/%s", async (runtime, mode) => {
    vi.stubEnv("NEXT_RUNTIME", runtime);
    vi.stubEnv("NODE_ENV", mode);

    register();
    await Promise.resolve();
    expect(warm).not.toHaveBeenCalled();
  });
});
