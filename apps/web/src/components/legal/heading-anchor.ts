import type { ReactNode } from "react";

const ANCHOR_PATTERN = /\s*\{#([\w-]+)\}\s*$/;

/**
 * Splits a trailing `{#anchor}` off a heading's children, so headings keep
 * stable ids that other pages link to (e.g. `/privacy-policy#funkcje-ai`).
 */
export function splitHeadingAnchor(children: ReactNode): {
  id: string | undefined;
  children: ReactNode;
} {
  const parts = Array.isArray(children)
    ? [...(children as ReactNode[])]
    : [children];
  const last = parts.at(-1);
  if (typeof last !== "string") {
    return { id: undefined, children };
  }
  const match = ANCHOR_PATTERN.exec(last);
  if (match === null) {
    return { id: undefined, children };
  }
  parts[parts.length - 1] = last.slice(0, match.index);
  return { id: match[1], children: parts.length === 1 ? parts[0] : parts };
}
