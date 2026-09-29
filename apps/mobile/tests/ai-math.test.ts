import { expect, it } from "vitest";
import { containsAiMath } from "../src/lib/ai-math";
import { richHtml } from "../src/lib/rich-html";
it("typesets complete dollar and LaTeX delimiters without requiring the network", () => {
  for (const text of [
    String.raw`What is $101_2$?`,
    String.raw`$$x^2$$`,
    String.raw`Use \(x^2\)`,
    String.raw`\[x^2\]`,
  ]) {
    expect(containsAiMath(text)).toBe(true);
    const html = richHtml(text, "#fff");
    expect(html).toContain('class="katex');
    expect(html).not.toContain('class="katex-error"');
    expect(html).toContain("font-src data:");
  }
});
it("keeps incomplete streaming formulas, escaped currency and code examples native", () => {
  for (const text of [
    "Hello",
    "$x +",
    String.raw`\(x +`,
    "`$x$`",
    "```tex\n$x$\n```",
    String.raw`Price: \$5 and \$10`,
  ])
    expect(containsAiMath(text)).toBe(false);
});
it("does not execute HTML, trusted KaTeX commands or remote AI images", () => {
  const html = richHtml(
    String.raw`$\href{javascript:alert(1)}{x}$ <script>alert(2)</script> ![x](https://untrusted.test/image.png)`,
    "#fff",
  );
  expect(html).not.toContain('href="javascript:');
  expect(html).not.toContain("<script>alert(2)");
  expect(html).not.toContain("<img");
});
