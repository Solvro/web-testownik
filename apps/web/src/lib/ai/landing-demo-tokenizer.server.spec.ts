import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { getLandingDemoTokenCounter } from "@/lib/ai/landing-demo-tokenizer.server";

vi.mock("server-only", () => ({}));

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

// Independent fixtures: Python tiktoken 0.14.0, get_encoding("o200k_base"),
// len(encoding.encode(text, disallowed_special=())). Never derive expected
// values with the counter under test.
describe("landing demo tokenizer", () => {
  it.each([
    ["ascii", "Hello, world!", 4],
    ["Polish", "Zażółć gęślą jaźń.", 12],
    ["rare script", "࠰".repeat(1000), 3000],
    ["emoji/ZWJ", "👩‍💻👨‍👩‍👧‍👦".repeat(100), 1600],
    ["surrogate pairs", "𐐷𝄞😀".repeat(100), 800],
    ["unpaired surrogate", "\uD800", 1],
  ])(
    "matches independent o200k_base counts for %s",
    async (_, text, expected) => {
      const count = await getLandingDemoTokenCounter();
      expect(count(text)).toBe(expected);
    },
  );

  it("shares the lazy load across concurrent requests", async () => {
    const first = getLandingDemoTokenCounter();
    const second = getLandingDemoTokenCounter();
    const count = await first;
    expect(await second).toBe(count);
    expect(await getLandingDemoTokenCounter()).toBe(count);
  });

  it("keeps the tokenizer behind a server-only boundary and the route on Node", () => {
    expect(source("./landing-demo-tokenizer.server.ts")).toContain(
      'import "server-only"',
    );
    expect(source("./landing-demo-chat.server.ts")).toContain(
      'import "server-only"',
    );
    for (const path of ["./landing-demo-chat.ts", "./chat-tools.ts"]) {
      expect(source(path)).not.toMatch(
        /js-tiktoken|landing-demo-tokenizer|landing-demo-chat\.server/,
      );
    }
    const route = source("../../app/ai/landing-demo/chat/route.ts");
    expect(route).toContain('export const runtime = "nodejs"');
    expect(route).toContain("export const maxDuration = 30");
  });

  it("uses a conservative byte fallback when the ranks cannot load", async () => {
    vi.resetModules();
    vi.doMock("js-tiktoken/ranks/o200k_base", () => {
      throw new Error("ranks unavailable");
    });
    try {
      const { getLandingDemoTokenCounter: getFallback } =
        await import("./landing-demo-tokenizer.server");
      const count = await getFallback();
      expect(count("Hello, world!")).toBe(17);
      expect(count("Zażółć gęślą jaźń.")).toBe(36);
      expect(count("࠰".repeat(1000))).toBe(3900);
      expect(count("👩‍💻👨‍👩‍👧‍👦".repeat(100))).toBe(4680);
      expect(count("𐐷𝄞😀".repeat(100))).toBe(1560);
      expect(await getFallback()).toBe(count);
    } finally {
      vi.doUnmock("js-tiktoken/ranks/o200k_base");
      vi.resetModules();
    }
  });
});
