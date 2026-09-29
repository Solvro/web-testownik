import { expect, it } from "vitest";

import { richHtml } from "../src/lib/rich-html";

it("renders offline math without accepting raw HTML or tracking images", () => {
  const html = richHtml(
    "$x^2$ <script>alert(1)</script> ![x](https://example.invalid/tracker)",
    "#123456",
  );
  expect(html).toContain("katex");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain('src="https://example.invalid/tracker"');
  expect(html).toContain("font-src data:");
});
it("scales text and measures intrinsic content, not the previous viewport", () => {
  const html = richHtml("short", "#fff", false, 2);
  expect(html).toContain("font:34px/1.55");
  expect(html).toContain("getBoundingClientRect().height");
  expect(html).not.toContain("document.documentElement.scrollHeight");
});
