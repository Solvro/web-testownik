import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { imageCacheName } from "../src/lib/image-cache-key";

it("uses stable SHA256 over exact UTF16 big-endian URL code units", () => {
  const url = "https://fixture.invalid/media/shared.png";
  const bytes = Buffer.from(url, "utf16le").swap16();
  expect(imageCacheName(url)).toBe(
    `${createHash("sha256").update(bytes).digest("hex")}.png`,
  );
});
it("does not depend on TextEncoder and preserves distinct Unicode and escape semantics", () => {
  vi.stubGlobal("TextEncoder", undefined);
  try {
    const urls = [
      "https://fixture.invalid/żółw.png?q=ę",
      "https://fixture.invalid/\ud800.png",
      "https://fixture.invalid/\ud801.png",
      "https://fixture.invalid/a%2Fb.png",
      "https://fixture.invalid/a/b.png",
      "https://fixture.invalid/a.png?x=1&x=2",
      "https://fixture.invalid/a.png?x=2&x=1",
      "https://fixture.invalid/a.png#first",
      "https://fixture.invalid/a.png#second",
    ];
    expect(new Set(urls.map(imageCacheName)).size).toBe(urls.length);
  } finally {
    vi.unstubAllGlobals();
  }
});
