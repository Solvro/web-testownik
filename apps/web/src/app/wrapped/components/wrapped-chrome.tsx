/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Image from "next/image";

import LogoFullDark from "@/assets/logo-full-dark.svg";
import LogoFull from "@/assets/logo-full.svg";

import type { ProgressStyle } from "../wrapped.config";
import { WrappedProgress } from "./wrapped-progress";

interface WrappedChromeProps {
  progressStyle: ProgressStyle;
  idx: number;
  count: number;
  yearLabel: string;
  /** True when the current slide background is dark (drives logo colour). */
  dark: boolean;
  onSeek: (index: number) => void;
  onSkip: () => void;
  /** Logo tap — wired to the theme easter egg. */
  onLogoClick?: () => void;
}

/** Top chrome: progress indicator, brand logo + pill, and skip button. */
export function WrappedChrome({
  progressStyle,
  idx,
  count,
  yearLabel,
  dark,
  onSeek,
  onSkip,
  onLogoClick,
}: WrappedChromeProps) {
  const showSkip = idx < count - 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 6,
        padding: "14px 18px 0",
        color: "var(--slide-fg, #fff)",
        pointerEvents: "none",
      }}
    >
      <WrappedProgress
        style={progressStyle}
        idx={idx}
        count={count}
        onSeek={onSeek}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "13px",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <button
            type="button"
            onClick={onLogoClick}
            aria-label="Testownik"
            title="Testownik"
            style={{
              pointerEvents: "auto",
              background: "none",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Image
              // Use the light-on-dark / dark-on-light logo variant per slide.
              src={dark ? LogoFullDark : LogoFull}
              alt="Testownik"
              className="block h-[17px] w-auto"
            />
          </button>
          <span
            style={{
              fontFamily: "var(--fm)",
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: "99px",
              background: "var(--hl)",
              color: "var(--slide-bg, #15171c)",
              whiteSpace: "nowrap",
            }}
          >
            Wrapped {yearLabel}
          </span>
        </span>
        {showSkip ? (
          <button
            type="button"
            onClick={onSkip}
            style={{
              pointerEvents: "auto",
              background: "none",
              border: "none",
              color: "currentColor",
              fontFamily: "var(--fm)",
              fontSize: "11px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              opacity: 0.65,
              cursor: "pointer",
              padding: "4px",
            }}
          >
            Pomiń
          </button>
        ) : null}
      </div>
    </div>
  );
}
