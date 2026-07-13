"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { formatValue } from "../format";
import type { WrappedFormat } from "../format";
import { usePrefersReducedMotion } from "../use-prefers-reduced-motion";
import { ENTER_MS } from "../wrapped.config";

function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - (1 - clamped) ** 3;
}

/**
 * Animates a number from 0 → `value` over `ENTER_MS` on mount. Because each
 * slide is keyed by index, this remounts (and replays) whenever its slide
 * becomes active. Honours `prefers-reduced-motion` by snapping to the final value.
 */
function useCountUp(value: number): number {
  const reduced = usePrefersReducedMotion();
  const [current, setCurrent] = useState(() => (reduced ? value : 0));

  useEffect(() => {
    if (reduced) {
      setCurrent(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const eased = easeOutCubic((t - start) / ENTER_MS);
      setCurrent(value * eased);
      if (eased < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [value, reduced]);

  return current;
}

interface CountUpProps {
  value: number;
  format?: WrappedFormat;
  className?: string;
  style?: CSSProperties;
}

export function CountUp({
  value,
  format = "int",
  className,
  style,
}: CountUpProps) {
  const current = useCountUp(value);
  return (
    <span className={className} style={style}>
      {formatValue(current, format)}
    </span>
  );
}

interface TimeCountUpProps {
  minutes: number;
  className?: string;
  style?: CSSProperties;
}

/** Animated study-time, split across two lines: hours then minutes. */
export function TimeCountUp({ minutes, className, style }: TimeCountUpProps) {
  const current = useCountUp(minutes);
  const total = Math.round(current);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return (
    <span className={className} style={style}>
      <span style={{ display: "block" }}>{String(hours)} godz</span>
      <span style={{ display: "block" }}>{String(mins)} min</span>
    </span>
  );
}
