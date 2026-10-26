import { describe, expect, it } from "vitest";

import {
  activeBlockFormats,
  activeInlineFormats,
  formatMarkdownSelection,
} from "./markdown-format";

describe("Markdown selection formatting", () => {
  it("formats Unicode text without changing adjacent content", () => {
    expect(formatMarkdownSelection("Zażółć gęślą jaźń", 7, 12, "bold")).toEqual(
      { value: "Zażółć **gęślą** jaźń", start: 9, end: 14 },
    );
  });

  it("places an empty cursor inside formatting markers", () => {
    expect(formatMarkdownSelection("abc", 1, 1, "math")).toEqual({
      value: "a$$bc",
      start: 2,
      end: 2,
    });
  });

  it("removes formatting whether the selection includes its markers or just its text", () => {
    expect(formatMarkdownSelection("**bold** tail", 0, 8, "bold")).toEqual({
      value: "bold tail",
      start: 0,
      end: 4,
    });
    expect(formatMarkdownSelection("**bold** tail", 2, 6, "bold")).toEqual({
      value: "bold tail",
      start: 0,
      end: 4,
    });
  });

  it("changes an existing heading instead of nesting heading markers", () => {
    expect(
      formatMarkdownSelection("before\n# Title\nafter", 10, 12, "h3").value,
    ).toBe("before\n### Title\nafter");
  });

  it("numbers selected lines and leaves the next line unchanged", () => {
    const formatted = formatMarkdownSelection(
      "first\nsecond\nthird",
      0,
      13,
      "numbered",
    );
    expect(formatted.value).toBe("1. first\n2. second\nthird");
    expect(
      formatMarkdownSelection(
        formatted.value,
        formatted.start,
        formatted.end,
        "numbered",
      ).value,
    ).toBe("first\nsecond\nthird");
  });

  it("applies and removes quotes on the current line with an empty selection", () => {
    const quoted = formatMarkdownSelection(
      "before\nline\nafter",
      8,
      8,
      "quote",
    );
    expect(quoted.value).toBe("before\n> line\nafter");
    expect(
      formatMarkdownSelection(quoted.value, quoted.start, quoted.end, "quote")
        .value,
    ).toBe("before\nline\nafter");
  });

  it("wraps block math and links with an editable text selection", () => {
    expect(formatMarkdownSelection("x+y", 0, 3, "mathBlock")).toEqual({
      value: "\n$$\nx+y\n$$\n",
      start: 4,
      end: 7,
    });
    expect(formatMarkdownSelection("link", 0, 4, "link")).toEqual({
      value: "[link](url)",
      start: 7,
      end: 10,
    });
    expect(formatMarkdownSelection("ab", 1, 1, "link")).toEqual({
      value: "a[](url)b",
      start: 2,
      end: 2,
    });
  });

  it("formats an empty first line before an existing newline", () => {
    expect(formatMarkdownSelection("\nline", 0, 0, "h1").value).toBe(
      "# \nline",
    );
  });

  it("reports the formats around the caret and removes them from inside", () => {
    const value = "Dziedziną **informatyki** i `kod` oraz $x$ i $$blok$$";
    expect(activeInlineFormats(value, 14, 14)).toEqual(["bold"]);
    expect(activeInlineFormats(value, 29, 32)).toEqual(["code"]);
    expect(activeInlineFormats(value, 40, 40)).toEqual(["math"]);
    expect(activeInlineFormats(value, 0, 0)).toEqual([]);
    expect(activeInlineFormats(value, 48, 48)).toEqual([]);
    expect(activeInlineFormats("_kursywa_ i *też*", 3, 3)).toEqual(["italic"]);
    expect(activeInlineFormats("snake_case_name", 8, 8)).toEqual(["italic"]);

    const result = formatMarkdownSelection(value, 14, 18, "bold");
    expect(result.value).toBe(
      "Dziedziną informatyki i `kod` oraz $x$ i $$blok$$",
    );
    expect([result.start, result.end]).toEqual([12, 16]);
    // Markers on another line do not count.
    expect(activeInlineFormats("**a\nb**", 4, 4)).toEqual([]);
  });

  it("reports empty spans around the caret", () => {
    expect(activeInlineFormats("a****b", 3, 3)).toEqual(["bold"]);
    expect(activeInlineFormats("a__b", 2, 2)).toEqual(["italic"]);
    expect(activeInlineFormats("a``b", 2, 2)).toEqual(["code"]);
    expect(activeInlineFormats("a$$b", 2, 2)).toEqual(["math"]);
    expect(activeInlineFormats("***x***", 4, 4)).toEqual([]);
    expect(formatMarkdownSelection("a****b", 3, 3, "bold")).toEqual({
      value: "ab",
      start: 1,
      end: 1,
    });
  });

  it("reports block formats on the selected lines and inside blocks", () => {
    expect(activeBlockFormats("> a\n> b\nc", 0, 5)).toEqual(["quote"]);
    expect(activeBlockFormats("> a\n> b\nc", 0, 9)).toEqual([]);
    expect(activeBlockFormats("## Tytuł", 3, 3)).toEqual(["h2"]);
    expect(activeBlockFormats("1. a\n2. b", 0, 9)).toEqual(["numbered"]);
    expect(activeBlockFormats("x\n```js\nkod\n```\ny", 8, 8)).toEqual([
      "codeBlock",
    ]);
    expect(activeBlockFormats("x\n```js\nkod\n```\ny", 0, 0)).toEqual([]);
    expect(activeBlockFormats("$$\n\n$$", 3, 3)).toEqual(["mathBlock"]);
    expect(activeBlockFormats("zob. [tu](url) i", 7, 7)).toEqual(["link"]);
    expect(activeBlockFormats("zob. [tu](url) i", 15, 15)).toEqual([]);
  });

  it("tells fence lines from inline math and longer code fences", () => {
    expect(activeBlockFormats("$$x$$\ntekst\n$$y$$", 7, 7)).toEqual([]);
    expect(
      formatMarkdownSelection("$$x$$\ntekst\n$$y$$", 7, 7, "mathBlock").value,
    ).toBe("$$x$$\nt\n$$\n\n$$\nekst\n$$y$$");
    expect(activeBlockFormats("````\n```\nx\n```\n````", 9, 9)).toEqual([
      "codeBlock",
    ]);
    expect(
      formatMarkdownSelection("````\n```\nx\n```\n````", 9, 9, "codeBlock")
        .value,
    ).toBe("```\nx\n```");
    expect(activeBlockFormats("```js\nkod\n```", 7, 7)).toEqual(["codeBlock"]);
  });

  it("leaves images and parenthesised addresses alone when removing a link", () => {
    const link = "[wiki](https://example.com/Foo_(bar)) i";
    expect(activeBlockFormats(link, 2, 2)).toEqual(["link"]);
    expect(formatMarkdownSelection(link, 2, 2, "link").value).toBe("wiki i");
    expect(activeBlockFormats("![alt](obraz.png)", 3, 3)).toEqual([]);
    expect(formatMarkdownSelection("![alt](obraz.png)", 3, 3, "link")).toEqual({
      value: "![a[](url)lt](obraz.png)",
      start: 4,
      end: 4,
    });
  });

  it("removes a fenced block or a link from inside", () => {
    expect(
      formatMarkdownSelection("x\n```\nkod\n```\ny", 7, 9, "codeBlock"),
    ).toEqual({ value: "x\nkod\ny", start: 3, end: 5 });
    expect(formatMarkdownSelection("a [tekst](url) b", 5, 5, "link")).toEqual({
      value: "a tekst b",
      start: 2,
      end: 7,
    });
  });
});
