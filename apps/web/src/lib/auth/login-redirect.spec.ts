import { describe, expect, it } from "vitest";

import { loginRedirect } from "./login-redirect";

describe("web login return destination", () => {
  it("preserves the OAuth request before hydration", () => {
    const path =
      "/oauth/authorize?client_id=testownik-mobile&redirect_uri=testownik%3A%2F%2Fauth&state=example&code_challenge=challenge";
    expect(loginRedirect(path, "http://localhost:3000")).toBe(
      `http://localhost:3000${path}`,
    );
  });
  it("uses an absolute web destination when no return path exists", () => {
    expect(loginRedirect(null, "http://localhost:3000")).toBe(
      "http://localhost:3000/quizzes",
    );
  });
  it.each([
    "https://untrusted.invalid/",
    "//untrusted.invalid/",
    "javascript:alert(1)",
    "http://[",
  ])("rejects an unsafe or malformed destination: %s", (path) => {
    expect(loginRedirect(path, "http://localhost:3000")).toBe(
      "http://localhost:3000/quizzes",
    );
  });
});
