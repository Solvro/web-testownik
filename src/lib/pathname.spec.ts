import { describe, expect, it } from "vitest";

import { normalizePathname, sanitizeRedirectPath } from "@/lib/pathname";

describe("normalizePathname", () => {
  it("collapses duplicated slashes", () => {
    expect(normalizePathname("////")).toBe("/");
    expect(normalizePathname("/quiz//123")).toBe("/quiz/123");
  });

  it("adds a missing leading slash", () => {
    expect(normalizePathname("quizzes")).toBe("/quizzes");
  });
});

describe("sanitizeRedirectPath", () => {
  it("returns fallback for malformed redirect values", () => {
    expect(sanitizeRedirectPath("////")).toBe("/quizzes");
  });

  it("returns fallback for external redirects", () => {
    expect(sanitizeRedirectPath("//evil.com")).toBe("/quizzes");
    expect(sanitizeRedirectPath("https://evil.com/phishing")).toBe("/quizzes");
  });

  it("keeps safe in-app redirects", () => {
    expect(sanitizeRedirectPath("/quizzes?sort=desc#all")).toBe(
      "/quizzes?sort=desc#all",
    );
  });
});
