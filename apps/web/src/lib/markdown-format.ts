export type MarkdownFormat =
  | "bold"
  | "italic"
  | "code"
  | "codeBlock"
  | "math"
  | "mathBlock"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "numbered"
  | "link";

const inlineMarkers: Partial<Record<MarkdownFormat, string[]>> = {
  bold: ["**"],
  italic: ["_", "*"],
  code: ["`"],
  math: ["$"],
};

/** Positions of `marker` in `line` which can open or close a span. */
function markerPositions(line: string, marker: string) {
  const positions: number[] = [];
  let index = line.indexOf(marker);
  while (index !== -1) {
    const before = line[index - 1];
    const after = line[index + marker.length];
    // A single `*`, `_` or `$` is not part of `**` or `$$`.
    const doubled =
      marker.length === 1 &&
      marker !== "`" &&
      (before === marker || after === marker);
    if (!doubled && !(marker === "**" && (before === "*" || after === "*"))) {
      positions.push(index);
    }
    index = line.indexOf(marker, index + marker.length);
  }
  return positions;
}

/**
 * The span of `marker` around the selection on its line, as the offsets of
 * the opening and closing markers, or null.
 */
function enclosingSpan(
  value: string,
  start: number,
  end: number,
  marker: string,
) {
  const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const newline = value.indexOf("\n", lineStart);
  const line = value.slice(lineStart, newline === -1 ? value.length : newline);
  const positions = markerPositions(line, marker);
  for (let index = 0; index + 1 < positions.length; index += 2) {
    const open = lineStart + positions[index];
    const close = lineStart + positions[index + 1];
    if (open + marker.length <= start && end <= close) {
      return { open, close };
    }
  }
  return null;
}

/** The inline formats whose markers surround the selection or caret. */
export function activeInlineFormats(value: string, start: number, end: number) {
  return (Object.keys(inlineMarkers) as MarkdownFormat[]).filter((format) =>
    (inlineMarkers[format] ?? []).some(
      (marker) => enclosingSpan(value, start, end, marker) !== null,
    ),
  );
}

export function formatMarkdownSelection(
  value: string,
  start: number,
  end: number,
  format: MarkdownFormat,
) {
  const selected = value.slice(start, end);
  if (format === "link") {
    // Leave the URL placeholder selected so it can be typed over directly.
    const prefix = `${value.slice(0, start)}[${selected}](`;
    return {
      value: `${prefix}url)${value.slice(end)}`,
      start: selected === "" ? start + 1 : prefix.length,
      end: selected === "" ? start + 1 : prefix.length + 3,
    };
  }
  const wrappers: Partial<Record<MarkdownFormat, [string, string]>> = {
    bold: ["**", "**"],
    italic: ["_", "_"],
    code: ["`", "`"],
    codeBlock: ["\n```\n", "\n```\n"],
    math: ["$", "$"],
    mathBlock: ["\n$$\n", "\n$$\n"],
  };
  const wrapper = wrappers[format];
  if (wrapper !== undefined) {
    const [prefix, suffix] = wrapper;
    const surrounding =
      value.slice(Math.max(0, start - prefix.length), start) === prefix &&
      value.slice(end, end + suffix.length) === suffix;
    const inside =
      selected.startsWith(prefix) &&
      selected.endsWith(suffix) &&
      selected.length >= prefix.length + suffix.length;
    if (surrounding) {
      const selectionStart = start - prefix.length;
      return {
        value:
          value.slice(0, selectionStart) +
          selected +
          value.slice(end + suffix.length),
        start: selectionStart,
        end: selectionStart + selected.length,
      };
    }
    if (inside) {
      const text = selected.slice(prefix.length, -suffix.length);
      return {
        value: value.slice(0, start) + text + value.slice(end),
        start,
        end: start + text.length,
      };
    }
    // Inside a span, even away from its markers: remove the span.
    for (const marker of inlineMarkers[format] ?? []) {
      const span = enclosingSpan(value, start, end, marker);
      if (span !== null) {
        return {
          value:
            value.slice(0, span.open) +
            value.slice(span.open + marker.length, span.close) +
            value.slice(span.close + marker.length),
          start: start - marker.length,
          end: end - marker.length,
        };
      }
    }
    return {
      value:
        value.slice(0, start) + prefix + selected + suffix + value.slice(end),
      start: start + prefix.length,
      end: end + prefix.length,
    };
  }
  const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = value.indexOf("\n", Math.max(start, end - 1));
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const prefixes = {
    h1: "# ",
    h2: "## ",
    h3: "### ",
    quote: "> ",
    bullet: "- ",
    numbered: "1. ",
  };
  const prefix = prefixes[format as keyof typeof prefixes];
  const allFormatted = lines.every((line) =>
    format === "numbered" ? /^\d+\. /.test(line) : line.startsWith(prefix),
  );
  const replacement = lines
    .map((line, index) => {
      if (allFormatted) {
        return format === "numbered"
          ? line.replace(/^\d+\. /, "")
          : line.slice(prefix.length);
      }
      const cleanLine = /^h[123]$/.test(format)
        ? line.replace(/^#{1,3} /, "")
        : line;
      return (
        (format === "numbered" ? `${String(index + 1)}. ` : prefix) + cleanLine
      );
    })
    .join("\n");
  return {
    value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + replacement.length,
  };
}
