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

it("preserves and escapes authored image descriptions, including inline formatting", () => {
  const html = richHtml(
    '![A **circuit** with "quotes" & arrows](https://example.com/image.png)',
    "#fff",
    true,
  );
  expect(html).toContain(
    'alt="A circuit with &quot;quotes&quot; &amp; arrows"',
  );
  expect(
    richHtml("![](https://example.com/decorative.png)", "#fff", true),
  ).toContain('alt=""');
});

it("uses downloaded bytes only after checking the original image's consent", () => {
  const resolve = (url: string) =>
    url.includes("trusted") ? "data:image/png;base64,AA==" : null;
  const html = richHtml(
    "![Diagram](https://trusted.test/a.png)",
    "#fff",
    true,
    1,
    17,
    "Hidden",
    resolve,
  );
  expect(html).toContain('src="data:image/png;base64,AA=="');
  expect(html).toContain('alt="Diagram"');
  const blocked = richHtml(
    "![Private](https://trusted.test/a.png)",
    "#fff",
    false,
    1,
    17,
    "Hidden",
    resolve,
  );
  expect(blocked).not.toContain('src="');
  expect(blocked).toContain("Hidden");
});

it("offers escaped failure feedback for approved images without changing their alt", () => {
  const html = richHtml(
    '![Circuit "A" & arrows](https://fixture.invalid/image.png)',
    "#000000",
    true,
    1,
    17,
    "Hidden",
    undefined,
    { failed: "Image <unavailable>", retry: 'Retry "image"' },
  );
  expect(html).toContain('alt="Circuit &quot;A&quot; &amp; arrows"');
  expect(html).toContain('<span role="status">Image &lt;unavailable&gt;');
  expect(html).toContain(
    'aria-label="Retry &quot;image&quot;: Circuit &quot;A&quot; &amp; arrows"',
  );
  expect(html.indexOf('document.addEventListener("error"')).toBeLessThan(
    html.indexOf('<span class="image-recovery">'),
  );
  expect(html).toContain("event.isTrusted");
  const blocked = richHtml(
    "![](https://outside.invalid/blocked.png)",
    "#000000",
    false,
  );
  expect(blocked).not.toContain('<button class="image-retry"');
  expect(blocked).not.toContain('src="https://outside.invalid/blocked.png"');
});

it("passive image recovery preserves failure status without an unreachable button", () => {
  const html = richHtml(
    "![Diagram](https://fixture.invalid/image.png)",
    "#000000",
    true,
    1,
    17,
    "Hidden",
    undefined,
    { failed: "Unavailable", retry: null, generation: 14 },
  );
  expect(html).toContain('<span role="status">Unavailable Diagram</span>');
  expect(html).not.toContain('<button class="image-retry"');
  expect(html).toContain("testownik:image-failed:14");
  expect(html).toContain("testownikImageFailed:14");
  expect(html).not.toContain("testownik:image-failed:https");
});
