import type { CSSProperties } from "react";

import type { ProgressStyle } from "../wrapped.config";

interface WrappedProgressProps {
  style: ProgressStyle;
  idx: number;
  count: number;
  onSeek: (index: number) => void;
}

/**
 * Story progress indicator. The active segment's fill is driven by the live
 * `--wr-progress` CSS variable (written each frame by the player), so it
 * animates without re-rendering.
 */
export function WrappedProgress({
  style,
  idx,
  count,
  onSeek,
}: WrappedProgressProps) {
  if (style === "none") {
    return null;
  }

  if (style === "numbers") {
    const label = `${String(idx + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
        <span
          style={{
            fontFamily: "var(--fm)",
            fontSize: "12px",
            letterSpacing: ".14em",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <div
          style={{
            flex: 1,
            height: "3px",
            background: "color-mix(in srgb, currentColor 22%, transparent)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "currentColor",
              transformOrigin: "left",
              transform: `scaleX(calc((${String(idx)} + var(--wr-progress, 0)) / ${String(count)}))`,
            }}
          />
        </div>
      </div>
    );
  }

  const isDots = style === "dots";
  const segments = Array.from({ length: count }, (_, index) => index);

  const fillTransform = (index: number): string => {
    const axis = isDots ? "scale" : "scaleX";
    if (index < idx) {
      return `${axis}(1)`;
    }
    if (index === idx) {
      return `${axis}(var(--wr-progress, 0))`;
    }
    return `${axis}(0)`;
  };

  const rowStyle: CSSProperties = isDots
    ? { display: "flex", gap: "6px", alignItems: "center" }
    : { display: "flex", gap: "5px", alignItems: "center" };

  return (
    <div style={rowStyle}>
      {segments.map((index) => (
        <button
          key={index}
          type="button"
          aria-label={`Slajd ${String(index + 1)}`}
          onClick={() => {
            onSeek(index);
          }}
          style={{
            flex: 1,
            height: isDots ? "18px" : "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: isDots ? "center" : "stretch",
            cursor: "pointer",
            pointerEvents: "auto",
            background: "none",
            border: "none",
            padding: 0,
            color: "inherit",
          }}
        >
          {isDots ? (
            <span
              style={{
                width: "11px",
                height: "11px",
                borderRadius: "50%",
                border: "1.6px solid currentColor",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "currentColor",
                  transformOrigin: "center",
                  transform: fillTransform(index),
                }}
              />
            </span>
          ) : (
            <span
              style={{
                width: "100%",
                height: "3px",
                background: "color-mix(in srgb, currentColor 26%, transparent)",
                borderRadius: "2px",
                overflow: "hidden",
                display: "block",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  background: "currentColor",
                  transformOrigin: "left",
                  transform: fillTransform(index),
                }}
              />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
