import { describe, expect, it } from "vitest";

import {
  formatAICompactCredits,
  formatAIResetAt,
  isAIUsageUnlimited,
  isAIUsageWindowUnlimited,
} from "./usage";

describe("formatAICompactCredits", () => {
  it.each([
    [500, "500"],
    [5000, "5k"],
    [32_304, "32k"],
    [2_500_000, "2.5m"],
  ])("formats %i credits as %s", (value, expected) => {
    expect(formatAICompactCredits(value)).toBe(expected);
  });
});

describe("isAIUsageUnlimited", () => {
  it("treats globally disabled limits as unlimited", () => {
    expect(
      isAIUsageUnlimited({
        limits_enabled: false,
        session: { limit: "50000" },
        weekly: { limit: "2500000" },
      }),
    ).toBe(true);
  });

  it("derives fully unlimited access from both nullable windows", () => {
    expect(
      isAIUsageUnlimited({
        limits_enabled: true,
        session: { limit: null },
        weekly: { limit: null },
      }),
    ).toBe(true);
  });

  it("keeps access limited while either window has a limit", () => {
    expect(
      isAIUsageUnlimited({
        limits_enabled: true,
        session: { limit: null },
        weekly: { limit: "2500000" },
      }),
    ).toBe(false);
  });
});

describe("isAIUsageWindowUnlimited", () => {
  it("recognizes a nullable window independently of the account-wide state", () => {
    expect(isAIUsageWindowUnlimited({ limit: null })).toBe(true);
  });

  it("keeps a finite window limited", () => {
    expect(isAIUsageWindowUnlimited({ limit: "50000" })).toBe(false);
  });
});

describe("formatAIResetAt", () => {
  const now = Date.parse("2026-08-22T18:00:00.000Z");

  it("uses seconds for short cooldowns", () => {
    expect(formatAIResetAt("2026-08-22T18:00:15.000Z", "full", now)).toBe(
      "za 15 s",
    );
  });

  it("uses minutes for nearby resets", () => {
    expect(formatAIResetAt("2026-08-22T18:02:01.000Z", "full", now)).toBe(
      "za 3 min",
    );
  });

  it("uses hours and minutes for resets later today", () => {
    expect(formatAIResetAt("2026-08-22T19:50:00.000Z", "short", now)).toBe(
      "za 1 godz. 50 min",
    );
  });

  it("marks elapsed cooldowns as available now", () => {
    expect(formatAIResetAt("2026-08-22T17:59:59.000Z", "full", now)).toBe(
      "teraz",
    );
  });
});
