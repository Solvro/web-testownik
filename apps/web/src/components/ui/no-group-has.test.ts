import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tailwind's `group-has-*` / `peer-has-*` variants compile to
 * `.x:is(:where(.group):has(…) *)`. A `:has()` whose target is `*` makes
 * Chrome restyle the whole document after any DOM insertion or removal once
 * the page also has other `:has()` rules (measured ~30 ms per mutation on the
 * landing page at 4x CPU throttling). Write the condition as an arbitrary
 * variant with the component's own class on the right instead, e.g.
 * `[:where([data-slot=field]):has(:disabled)_&]:opacity-50`.
 */
const SOURCE_ROOT = path.resolve(import.meta.dirname, "../..");
const VARIANT = /(?:^|[\s"'`])(?:[\w@/[\]=-]+:)*(?:group|peer)-has-[^\s"'`]*:/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(?:tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("Tailwind :has() variants", () => {
  it("does not use group-has-* or peer-has-*", () => {
    const offenders = sourceFiles(SOURCE_ROOT).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          VARIANT.test(line)
            ? [`${path.relative(SOURCE_ROOT, file)}:${String(index + 1)}`]
            : [],
        ),
    );

    expect(offenders).toEqual([]);
  });
});
