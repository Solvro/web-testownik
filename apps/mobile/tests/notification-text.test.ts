import { expect, it } from "vitest";
import {
  notificationParts,
  notificationText,
} from "../src/lib/notification-text";
it("renders notification HTML as readable native text without executable content", () => {
  expect(
    notificationText(
      "<p>Hello <strong>student</strong> &amp; friends.</p><p>Next<br>line</p><script>alert(1)</script><style>body{color:red}</style>",
    ),
  ).toBe("Hello student & friends.\nNext\nline");
});

it("makes explicit web links actionable without including surrounding punctuation", () => {
  const parts = notificationParts(
    "Read [the guide](https://example.org/guide?a=1&b=2), then https://example.org/wiki/Example_(term).",
  );
  expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual([
    "https://example.org/guide?a=1&b=2",
    "https://example.org/wiki/Example_(term)",
  ]);
  expect(parts.map((part) => part.text).join("")).toBe(
    notificationText(
      "Read [the guide](https://example.org/guide?a=1&b=2), then https://example.org/wiki/Example_(term).",
    ),
  );
});

it("keeps custom schemes and emails inert and never loads hidden markup", () => {
  const parts = notificationParts(
    '<script>https://hidden.example.org</script><a href="javascript:alert(1)">Unsafe</a> mail@example.org testownik://login file:///tmp/test',
  );
  expect(parts.some((part) => part.href)).toBe(false);
  expect(parts.map((part) => part.text).join("")).not.toContain(
    "hidden.example.org",
  );
});
it("preserves link destinations and Markdown list content", () => {
  const text = notificationText(
    "**Updates**\n\n- [Open quiz](https://example.invalid/quiz)\n- Save progress",
  );
  expect(text).toContain("Updates");
  expect(text).toContain("• Open quiz (https://example.invalid/quiz)");
  expect(text).toContain("• Save progress");
  expect(text).not.toContain("<");
});
it("does not turn encoded tags or unsafe links into active elements", () => {
  expect(
    notificationText(
      '<p>&lt;script&gt;read me&lt;/script&gt;</p><a href="javascript:alert(1)">label</a>',
    ),
  ).toBe("<script>read me</script>\nlabel");
});
