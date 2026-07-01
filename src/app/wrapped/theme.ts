import type { Palette } from "./wrapped.config";

/** Per-slide resolved colours. */
export interface SlideColors {
  bg: string;
  fg: string;
  accent: string;
  danger: string;
}

function parseHex(hex: string): number | null {
  if (!hex.startsWith("#")) {
    return null;
  }
  const h = hex.replace("#", "");
  // Expand shorthand (#abc → #aabbcc) by doubling each hex digit.
  const full = h.length === 3 ? h.replaceAll(/(.)/g, "$1$1") : h;
  return Number.parseInt(full, 16);
}

/** Translate a hex colour to an `rgba()` string at the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseHex(hex);
  if (n === null) {
    return hex;
  }
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${String(r)},${String(g)},${String(b)},${String(alpha)})`;
}

/** Perceptual-luminance check used to pick a readable accent. */
export function isDark(hex: string): boolean {
  const n = parseHex(hex);
  if (n === null) {
    return false;
  }
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
}

/** Deterministic LCG — same seed always yields the same decoration layout. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}

/** Resolve background / foreground / accent / danger for a slide index. */
export function slideColors(palette: Palette, index: number): SlideColors {
  const n = palette.pop.length;
  const bg = palette.pop[index % n];
  const fg = palette.fg[index % n];
  const accent = isDark(bg) ? palette.hlDark : fg;
  return { bg, fg, accent, danger: palette.danger };
}

/** Seeded array shuffle (Fisher–Yates). */
export function shuffle<T>(array: readonly T[], rng: () => number): T[] {
  const a = [...array];
  for (let index = a.length - 1; index > 0; index--) {
    const target = Math.trunc(rng() * (index + 1));
    [a[index], a[target]] = [a[target], a[index]];
  }
  return a;
}
