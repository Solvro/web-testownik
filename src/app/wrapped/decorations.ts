import type { CSSProperties } from "react";

import { createRng, shuffle, withAlpha } from "./theme";
import type { DecorationName } from "./wrapped.config";

/** A custom-property-friendly style object. */
type DecoStyle = CSSProperties & Record<`--${string}`, string | number>;

const STAR =
  "polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)";

const CONFETTI_COLORS = [
  "#ff5147",
  "#c6ff3a",
  "#19d3da",
  "#ffb020",
  "#ff3d8b",
  "#7b2dff",
];

// Small CSS-unit helpers — keep numeric interpolation out of template literals.
const toPx = (v: number): string => `${String(v)}px`;
const toPct = (v: number): string => `${String(v)}%`;
const toDeg = (v: number): string => `rotate(${String(v)}deg)`;

/** Wrap an SVG markup string into a `url(data:…)` value. */
function svgUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Build the decorative layer for a slide. Deterministic per `index` (seeded), so
 * the layout is stable across re-renders but differs from slide to slide.
 *
 * Ported from the original Spotify-Wrapped prototype. Returns plain style
 * objects to be spread onto absolutely-positioned `<div>`s.
 */
export function buildDecorations(
  kind: DecorationName,
  fg: string,
  index: number,
  danger: string,
): DecoStyle[] {
  const out: DecoStyle[] = [];
  const slideIndex = Math.trunc(index);
  const seed = (slideIndex * 1297 + 71) >>> 0;

  switch (kind) {
    case "sparks": {
      const r = createRng(seed + 7);
      for (let index_ = 0; index_ < 16; index_++) {
        const sz = 9 + r() * 18;
        out.push({
          position: "absolute",
          left: toPct(r() * 92),
          top: toPct(r() * 92),
          width: toPx(sz),
          height: toPx(sz),
          background: fg,
          clipPath: STAR,
          opacity: Number((0.14 + r() * 0.26).toFixed(2)),
          transform: toDeg(Math.trunc(r() * 90)),
        });
      }
      break;
    }
    case "confetti": {
      const r = createRng(seed + 13);
      for (let index_ = 0; index_ < 24; index_++) {
        out.push({
          position: "absolute",
          left: toPct(r() * 94),
          top: toPct(r() * 94),
          width: "7px",
          height: "14px",
          background: CONFETTI_COLORS[Math.trunc(r() * CONFETTI_COLORS.length)],
          opacity: 0.6,
          borderRadius: "1px",
          transform: toDeg(Math.trunc(r() * 180)),
        });
      }
      break;
    }
    case "blobs": {
      const r = createRng(seed + 21);
      for (let index_ = 0; index_ < 6; index_++) {
        const sz = 150 + r() * 200;
        out.push({
          position: "absolute",
          left: toPct(r() * 80 - 12),
          top: toPct(r() * 80 - 12),
          width: toPx(sz),
          height: toPx(sz),
          background: fg,
          opacity: 0.08,
          borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%",
          filter: "blur(10px)",
        });
      }
      break;
    }
    case "summer": {
      // Real summer illustrations (OpenMoji, CC BY-SA 4.0), shuffled per slide.
      const base =
        "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.0.0/color/svg/";
      const r = createRng(seed + 33);
      const pool = shuffle(
        [
          "2600",
          "1F334",
          "1F349",
          "1F379",
          "1F576",
          "1F366",
          "1F33A",
          "1F34D",
          "1F3D6",
          "1F41A",
        ],
        r,
      );
      // Sit at the frame edges — visible, but the content vignette keeps them
      // from competing with the central text.
      const slots: { c: CSSProperties; big?: boolean; spin?: boolean }[] = [
        { c: { top: "6%", right: "2%" }, big: true, spin: true },
        {
          c: { bottom: "1%", right: "2%", transformOrigin: "bottom center" },
          big: true,
        },
        { c: { bottom: "3%", left: "2%" } },
        { c: { top: "8%", left: "1%" } },
        { c: { bottom: "18%", right: "3%" } },
        { c: { bottom: "14%", left: "3%" } },
      ];
      for (const [index_, slot] of slots.entries()) {
        const code = pool[index_ % pool.length];
        const sz = (slot.big === true ? 100 : 52) + Math.trunc(r() * 14);
        const anim =
          slot.spin === true
            ? `wr-spin ${String(70 + Math.trunc(r() * 22))}s linear infinite`
            : `${r() < 0.5 ? "wr-float " : "wr-sway "}${(4.6 + r() * 2).toFixed(1)}s ease-in-out ${(r() * 0.9).toFixed(1)}s infinite`;
        out.push({
          position: "absolute",
          backgroundImage: `url('${base}${code}.svg')`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain",
          width: toPx(sz),
          height: toPx(sz),
          "--r": `${String(Math.trunc(r() * 16 - 8))}deg`,
          filter: "drop-shadow(0 6px 14px rgba(0,0,0,.18))",
          pointerEvents: "none",
          animation: anim,
          ...slot.c,
        });
      }
      for (let index_ = 0; index_ < 3; index_++) {
        const sz = 16 + r() * 10;
        out.push({
          position: "absolute",
          left: `${(14 + r() * 64).toFixed(1)}%`,
          top: `${(15 + r() * 30).toFixed(1)}%`,
          width: toPx(sz),
          height: toPx(sz),
          backgroundImage: `url('${base}2728.svg')`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain",
          opacity: 0.8,
          animation: `wr-twinkle ${(2.4 + r()).toFixed(1)}s ease-in-out ${r().toFixed(1)}s infinite`,
        });
      }
      break;
    }
    case "wrapped": {
      // Liquid gradient blobs + rainbow ribbon + pixel squiggle.
      const r = createRng(seed + 51);
      const cols = [
        ["#7b2dff", "#19d3da"],
        ["#ff5147", "#ffb020"],
        ["#c6ff3a", "#19d3da"],
        ["#ff3d8b", "#7b2dff"],
        ["#ffb020", "#ff3d8b"],
      ];
      const blobPos: CSSProperties[] = [
        { top: "-8%", left: "-8%" },
        { bottom: "-10%", right: "-8%" },
        { top: "34%", right: "-12%" },
      ];
      for (const [index_, p] of blobPos.entries()) {
        const c = cols[(slideIndex + index_) % cols.length];
        const sz = 220 + Math.trunc(r() * 130);
        out.push({
          position: "absolute",
          width: toPx(sz),
          height: toPx(sz),
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${c[0]}, ${c[1]} 68%, transparent 72%)`,
          filter: "blur(16px)",
          opacity: 0.5,
          animation: `wr-float ${(9 + r() * 6).toFixed(1)}s ease-in-out ${r().toFixed(1)}s infinite`,
          ...p,
        });
      }
      const ribbon =
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff5147'/><stop offset='.3' stop-color='#ffb020'/><stop offset='.55' stop-color='#c6ff3a'/><stop offset='.78' stop-color='#19d3da'/><stop offset='1' stop-color='#7b2dff'/></linearGradient></defs><path d='M8,128 C44,36 96,44 112,112 S182,176 196,84' fill='none' stroke='url(#g)' stroke-width='15' stroke-linecap='round'/></svg>";
      out.push({
        position: "absolute",
        top: `${(-2 + r() * 30).toFixed(0)}%`,
        right: `${(-8 + r() * 14).toFixed(0)}%`,
        width: "72%",
        height: "72%",
        backgroundImage: svgUri(ribbon),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "contain",
        opacity: 0.92,
        transform: toDeg((slideIndex * 47) % 360),
      });
      const pixels =
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 60'><polyline points='0,40 18,40 18,20 40,20 40,46 64,46 64,16 90,16 90,42 116,42 116,22 142,22 142,48 168,48 168,18 196,18 196,40 220,40 220,24 240,24' fill='none' stroke='#ffe14d' stroke-width='9'/></svg>";
      out.push({
        position: "absolute",
        left: `${(1 + r() * 8).toFixed(0)}%`,
        bottom: `${(2 + r() * 9).toFixed(0)}%`,
        width: "62%",
        height: "72px",
        backgroundImage: svgUri(pixels),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left center",
        backgroundSize: "contain",
        opacity: 0.85,
      });
      break;
    }
    case "lines": {
      // Warped B&W concentric rings + scribble + red/black dot cluster.
      const r = createRng(seed + 67);
      const ink = fg;
      const redc = danger || "#ff2d2d";
      const corners: CSSProperties[] = [
        { top: "-10%", left: "-9%" },
        { top: "-10%", right: "-9%" },
        { bottom: "-10%", left: "-9%" },
        { bottom: "-10%", right: "-9%" },
      ];
      out.push({
        position: "absolute",
        width: "64%",
        height: "42%",
        background: `repeating-radial-gradient(circle at center, ${withAlpha(ink, 0.5)} 0 11px, transparent 11px 22px)`,
        transform: `scaleX(1.35) rotate(${String(((slideIndex * 23) % 44) - 22)}deg)`,
        opacity: 0.6,
        ...corners[slideIndex % corners.length],
      });
      const scrib = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'><path d='M6,60 C40,8 60,8 70,52 C80,96 110,96 120,52 C130,10 156,10 178,46 C190,66 178,92 150,86' fill='none' stroke='${ink}' stroke-width='3' stroke-linecap='round'/></svg>`;
      out.push({
        position: "absolute",
        top: `${(8 + r() * 16).toFixed(0)}%`,
        left: `${(8 + r() * 22).toFixed(0)}%`,
        width: "60%",
        height: "36%",
        backgroundImage: svgUri(scrib),
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "contain",
        opacity: 0.7,
        transform: toDeg(((slideIndex * 37) % 34) - 17),
      });
      for (let index_ = 0; index_ < 11; index_++) {
        const sz = 9 + r() * 17;
        const isRed = r() < 0.45;
        out.push({
          position: "absolute",
          left: `${(50 + r() * 48).toFixed(1)}%`,
          bottom: `${(2 + r() * 32).toFixed(1)}%`,
          width: toPx(sz),
          height: toPx(sz),
          borderRadius: "50%",
          background: isRed ? redc : withAlpha(ink, 0.8),
        });
      }
      break;
    }
    case "none":
    default: {
      break;
    }
  }

  return out;
}
