import { describe, it, expect } from "vitest";
import { parseEmbeddedTheme } from "../src/lib/embed-theme";
describe("Wrapped theme messages", () => {
  it("accepts only explicit slide colors", () => {
    expect(
      parseEmbeddedTheme(
        JSON.stringify({
          type: "wrapped-theme",
          background: "#15171c",
          foreground: "#ffffff",
          dark: true,
        }),
      ),
    ).toEqual({ background: "#15171c", foreground: "#ffffff", dark: true });
  });
  it.each([
    "not json",
    "null",
    "[]",
    JSON.stringify({
      type: "wrapped-theme",
      background: "url(https://untrusted.invalid)",
      foreground: "#ffffff",
      dark: true,
    }),
    JSON.stringify({
      type: "other",
      background: "#000000",
      foreground: "#ffffff",
      dark: true,
    }),
    "x".repeat(257),
  ])("ignores malformed or unexpected input", (message) =>
    expect(parseEmbeddedTheme(message)).toBeNull(),
  );
});
