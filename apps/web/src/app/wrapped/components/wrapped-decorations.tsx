import type { CSSProperties } from "react";

import { buildDecorations } from "../decorations";
import type { DecorationName } from "../wrapped.config";

interface WrappedDecorationsProps {
  kind: DecorationName;
  /** Current slide foreground colour (decorations key off it). */
  fg: string;
  danger: string;
  idx: number;
}

function decorationKey(style: CSSProperties): string {
  return Object.entries(style)
    .map(([property, value]) => `${property}:${String(value)}`)
    .join(";");
}

/** Absolutely-positioned decorative layer behind the slide content. */
export function WrappedDecorations({
  kind,
  fg,
  danger,
  idx,
}: WrappedDecorationsProps) {
  if (kind === "none") {
    return null;
  }
  const items = buildDecorations(kind, fg, idx, danger);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {items.map((style) => (
        <div
          key={`${kind}-${String(idx)}-${decorationKey(style)}`}
          style={style}
        />
      ))}
    </div>
  );
}
