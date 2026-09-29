import { expect, it } from "vitest";
import {
  imageAllowed,
  isTrustedImage,
  markdownImages,
} from "../src/lib/image-policy";
import { richHtml } from "../src/lib/rich-html";
it("loads first-party and existing trusted media without approving lookalike domains", () => {
  const api = "http://localhost:8765/api";
  expect(isTrustedImage("http://localhost:8765/media/image.avif", api)).toBe(
    true,
  );
  expect(isTrustedImage("https://s3.b.solvro.pl/image.avif", api)).toBe(true);
  expect(
    isTrustedImage("https://s3.b.solvro.pl.attacker.invalid/image", api),
  ).toBe(false);
  expect(imageAllowed("file:///private/image.png", true)).toBe(false);
  expect(imageAllowed("javascript:alert(1)", true)).toBe(false);
});
it("finds inline, linked and reference Markdown images", () => {
  expect(
    markdownImages(
      "[![one](https://one.invalid/a)](https://link.invalid)\n![two][source]\n\n[source]: https://two.invalid/b",
    ),
  ).toEqual(["https://one.invalid/a", "https://two.invalid/b"]);
});
it("applies per-source approval and localized placeholders inside rich text", () => {
  const html = richHtml(
    "![one](https://one.invalid/a) ![two](https://two.invalid/b)",
    "#fff",
    (url) => url.startsWith("https://one.invalid/"),
    1,
    17,
    "External image hidden",
  );
  expect(html).toContain('src="https://one.invalid/a"');
  expect(html).not.toContain('src="https://two.invalid/b"');
  expect(html).toContain("[External image hidden]");
});
