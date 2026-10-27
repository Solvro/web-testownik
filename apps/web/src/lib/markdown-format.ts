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

/**
 * Positions of `marker` in `line` which can open or close a span. A run of
 * the marker's character is read as a whole: `****` is two bold markers
 * around nothing, while `***` could be bold or italic and counts as neither.
 */
function markerPositions(line: string, marker: string) {
  const positions: number[] = [];
  const char = marker[0];
  let index = 0;
  while (index < line.length) {
    if (line[index] !== char) {
      index++;
      continue;
    }
    let run = 1;
    while (line[index + run] === char) {
      run++;
    }
    if (marker === "**") {
      if (run % 2 === 0) {
        for (let offset = 0; offset < run; offset += 2) {
          positions.push(index + offset);
        }
      }
    } else if (marker === "*") {
      // Two or more are bold.
      if (run === 1) {
        positions.push(index);
      }
    } else if (marker === "`" || run <= 2) {
      // `__` and `$$` are empty spans; longer runs are not markers.
      for (let offset = 0; offset < run; offset++) {
        positions.push(index + offset);
      }
    }
    index += run;
  }
  return positions;
}

/** The line containing `start`, as offsets into `value`. */
function lineAt(value: string, start: number) {
  const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const newline = value.indexOf("\n", lineStart);
  return {
    lineStart,
    line: value.slice(lineStart, newline === -1 ? value.length : newline),
  };
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
  const { lineStart, line } = lineAt(value, start);
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

/**
 * The inline formats whose markers surround the selection or caret. Inside
 * a fenced block there are none, and inside a code span only the code.
 */
export function activeInlineFormats(
  value: string,
  start: number,
  end: number,
): MarkdownFormat[] {
  if (enclosingBlock(value, start, end) !== null) {
    return [];
  }
  const inCode = enclosingSpan(value, start, end, "`") !== null;
  return (Object.keys(inlineMarkers) as MarkdownFormat[]).filter(
    (format) =>
      (!inCode || format === "code") &&
      (inlineMarkers[format] ?? []).some(
        (marker) => enclosingSpan(value, start, end, marker) !== null,
      ),
  );
}

const linePrefixes = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  quote: "> ",
  bullet: "- ",
  numbered: "1. ",
};

type LineFormat = keyof typeof linePrefixes;

function isLineFormat(format: MarkdownFormat): format is LineFormat {
  return format in linePrefixes;
}

function hasLinePrefix(line: string, format: LineFormat) {
  return format === "numbered"
    ? /^\d+\. /.test(line)
    : line.startsWith(linePrefixes[format]);
}

/** The whole lines touched by the selection. */
function selectedLines(value: string, start: number, end: number) {
  const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = value.indexOf("\n", Math.max(start, end - 1));
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;
  return {
    lineStart,
    lineEnd,
    lines: value.slice(lineStart, lineEnd).split("\n"),
  };
}

const fences = { codeBlock: "```", mathBlock: "$$" };

/**
 * The length of the fence a line opens, or 0. A code fence is three or more
 * backticks, optionally followed by a language; a math fence is `$$` alone,
 * as `$$x$$` on one line is inline math.
 */
function openingFence(line: string, fence: string) {
  if (fence === "$$") {
    return /^ {0,3}\$\$\s*$/.test(line) ? 2 : 0;
  }
  const match = /^ {0,3}(`{3,})[^`]*$/.exec(line);
  return match === null ? 0 : match[1].length;
}

/**
 * Whether a line closes a fence of `length` characters. Like the opening,
 * it may be indented by up to three spaces; deeper indentation is content.
 */
function closesFence(line: string, fence: string, length: number) {
  if (fence === "$$") {
    return /^ {0,3}\$\$\s*$/.test(line);
  }
  const match = /^ {0,3}(`{3,})\s*$/.exec(line);
  return match !== null && match[1].length >= length;
}

type FenceKind = keyof typeof fences;

/**
 * The fenced block whose fence lines surround the selection, as its kind and
 * the offsets of those lines, or null. Fences inside another block are its
 * content, so only the outermost block counts.
 */
function enclosingBlock(value: string, start: number, end: number) {
  let open: {
    kind: FenceKind;
    start: number;
    end: number;
    length: number;
  } | null = null;
  let position = 0;
  for (const line of value.split("\n")) {
    const lineEnd = position + line.length;
    if (open === null) {
      for (const kind of Object.keys(fences) as FenceKind[]) {
        const length = openingFence(line, fences[kind]);
        if (length > 0) {
          open = { kind, start: position, end: lineEnd, length };
          break;
        }
      }
    } else if (closesFence(line, fences[open.kind], open.length)) {
      // The selection may end with the newline before the closing fence.
      if (open.end < start && end <= position) {
        return {
          kind: open.kind,
          open,
          close: { start: position, end: lineEnd },
        };
      }
      open = null;
    }
    position = lineEnd + 1;
  }
  return null;
}

/** Whether the character at `index` is escaped by an odd run of backslashes. */
function isEscaped(line: string, index: number) {
  let backslashes = 0;
  while (
    index - backslashes - 1 >= 0 &&
    line[index - backslashes - 1] === "\\"
  ) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

/**
 * The index after the delimiter closing the one at `index`, skipping escaped
 * characters and nested pairs, or -1.
 */
function closingDelimiter(
  line: string,
  index: number,
  open: string,
  close: string,
) {
  let depth = 0;
  for (let position = index; position < line.length; position++) {
    switch (line[position]) {
      case "\\": {
        position++;
        break;
      }
      case open: {
        depth++;
        break;
      }
      case close: {
        depth--;
        if (depth === 0) {
          return position + 1;
        }
        break;
      }
      default: {
        break;
      }
    }
  }
  return -1;
}

interface Link {
  open: number;
  close: number;
  text: string;
}

/**
 * The links on a line: `[text](url)`, where the text and the address may
 * hold nested brackets or parentheses and escaped characters. An image
 * `![alt](src)` and an escaped `\[` are not links, and neither is a pair
 * of brackets around another link, as a link cannot contain one.
 */
function* linksIn(line: string): Generator<Link> {
  for (let index = 0; index < line.length; index++) {
    if (
      line[index] !== "[" ||
      isEscaped(line, index) ||
      (line[index - 1] === "!" && !isEscaped(line, index - 1))
    ) {
      continue;
    }
    const afterText = closingDelimiter(line, index, "[", "]");
    if (afterText === -1 || line[afterText] !== "(") {
      continue;
    }
    const afterAddress = closingDelimiter(line, afterText, "(", ")");
    if (afterAddress === -1) {
      continue;
    }
    const text = line.slice(index + 1, afterText - 1);
    if (hasLink(text)) {
      continue;
    }
    yield { open: index, close: afterAddress, text };
    index = afterAddress - 1;
  }
}

function hasLink(text: string) {
  return linksIn(text).next().done !== true;
}

/** The link around the selection on its line, or null. */
function enclosingLink(value: string, start: number, end: number) {
  const { lineStart, line } = lineAt(value, start);
  for (const link of linksIn(line)) {
    const open = lineStart + link.open;
    const close = lineStart + link.close;
    if (open <= start && end <= close) {
      return { open, close, text: link.text };
    }
  }
  return null;
}

/**
 * The block formats applied to the selected lines, or around the caret.
 * Inside a fenced block, Markdown is content, so only the block counts.
 */
export function activeBlockFormats(
  value: string,
  start: number,
  end: number,
): MarkdownFormat[] {
  const block = enclosingBlock(value, start, end);
  if (block !== null) {
    return [block.kind];
  }
  const { lines } = selectedLines(value, start, end);
  const active: MarkdownFormat[] = (
    Object.keys(linePrefixes) as LineFormat[]
  ).filter((format) => lines.every((line) => hasLinePrefix(line, format)));
  if (enclosingLink(value, start, end) !== null) {
    active.push("link");
  }
  return active;
}

/** All formats which apply to the selection or caret. */
export function activeFormats(value: string, start: number, end: number) {
  return [
    ...activeInlineFormats(value, start, end),
    ...activeBlockFormats(value, start, end),
  ];
}

/**
 * The fenced block the selection is inside, if any. Markdown is content
 * there, so only that block can be formatted: toggling it off.
 */
export function literalBlock(value: string, start: number, end: number) {
  return enclosingBlock(value, start, end)?.kind ?? null;
}

export function formatMarkdownSelection(
  value: string,
  start: number,
  end: number,
  format: MarkdownFormat,
) {
  const selected = value.slice(start, end);
  const literal = literalBlock(value, start, end);
  if (literal !== null && literal !== format) {
    return { value, start, end };
  }
  if (format === "link") {
    const link = enclosingLink(value, start, end);
    if (link !== null) {
      return {
        value: value.slice(0, link.open) + link.text + value.slice(link.close),
        start: link.open,
        end: link.open + link.text.length,
      };
    }
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
    // A fenced block is judged by its fence lines, not by the text next to
    // the selection, which could be a block's literal content.
    const fenced = format === "codeBlock" || format === "mathBlock";
    const block = fenced ? enclosingBlock(value, start, end) : null;
    if (block !== null && block.kind === format) {
      const removed = block.open.end + 1 - block.open.start;
      return {
        value:
          value.slice(0, block.open.start) +
          value.slice(block.open.end + 1, block.close.start - 1) +
          value.slice(block.close.end),
        start: start - removed,
        end: end - removed,
      };
    }
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
  if (!isLineFormat(format)) {
    return { value, start, end };
  }
  const { lineStart, lineEnd, lines } = selectedLines(value, start, end);
  const prefix = linePrefixes[format];
  const allFormatted = lines.every((line) => hasLinePrefix(line, format));
  const replacement = lines
    .map((line, index) => {
      if (allFormatted) {
        return format === "numbered"
          ? line.replace(/^\d+\. /, "")
          : line.slice(prefix.length);
      }
      const cleanLine = /^h[123]$/.test(format)
        ? line.replace(/^#{1,6} /, "")
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
