import { describe, it, expect } from "vitest";
import { canNavigateEmbedded, embeddedPath } from "../src/lib/embed-navigation";
describe("embedded report navigation", () => {
  const origin = "http://localhost:3000";
  const destination = embeddedPath({ quizId: "a-b" });
  it("keeps the selected report inside the isolated browser", () => {
    expect(destination).toBe("/quiz/a-b/stats");
    expect(
      canNavigateEmbedded(
        `${origin}${destination}?scope=all`,
        origin,
        destination,
      ),
    ).toBe(true);
    expect(
      canNavigateEmbedded(`${origin}/auth/mobile`, origin, destination),
    ).toBe(true);
  });
  it.each([
    "https://untrusted.invalid/quiz/a-b/stats",
    "http://localhost:3000/quiz/another/stats",
    "http://localhost:3000/admin",
    "javascript:alert(1)",
    "http://localhost:3000/quiz/a-b/stats-evil",
  ])("does not navigate to %s with the embedded session", (url) => {
    expect(canNavigateEmbedded(url, origin, destination)).toBe(false);
  });
  it("retains Wrapped destinations", () => {
    expect(embeddedPath({})).toBe("/wrapped");
    expect(embeddedPath({ global: true })).toBe("/wrapped/global");
  });
});
