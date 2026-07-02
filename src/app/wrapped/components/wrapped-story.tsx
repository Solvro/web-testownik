"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";

import type { WrappedData, WrappedStoryData } from "@/types/wrapped";
import { isWrappedStoryData } from "@/types/wrapped";

import { shareWrapped } from "../share-image";
import type { ShareTheme } from "../share-image";
import { SLIDE_REGISTRY } from "../slides";
import { isDark, slideColors } from "../theme";
import { useImmersiveThemeColor } from "../use-immersive-theme-color";
import { useWrappedPlayer } from "../use-wrapped-player";
import type { WrappedSettings } from "../wrapped.config";
import { DEFAULT_DURATION, PALETTES, resolveSlides } from "../wrapped.config";
import { WrappedEmptyState } from "./empty-state";
import { WrappedChrome } from "./wrapped-chrome";
import { WrappedDecorations } from "./wrapped-decorations";

type StageStyle = CSSProperties & Record<`--${string}`, string>;

function cssVariable(
  style: CSSStyleDeclaration,
  name: string,
  fallback: string,
): string {
  return style.getPropertyValue(name).trim() || fallback;
}

/** Wrap the stage in the centred phone-sized shell. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrapped-shell-wrap">
      <div className="wrapped-shell">{children}</div>
    </div>
  );
}

function StoryPlayer({
  data,
  settings,
  onLogoClick,
}: {
  data: WrappedStoryData;
  settings: WrappedSettings;
  onLogoClick?: () => void;
}) {
  const slides = resolveSlides(data);
  const count = slides.length;
  const palette = PALETTES[settings.palette];

  const getDuration = (target: number) =>
    slides[target]?.duration ?? DEFAULT_DURATION;

  const player = useWrappedPlayer({ count, getDuration });
  const sharing = useRef(false);

  const index = Math.min(player.idx, count - 1);
  const colors = slideColors(palette, index);
  const slideId = slides[index].id;
  const Slide = SLIDE_REGISTRY[slideId];
  const isEdgeSlide = index === 0 || index === count - 1;

  // Edge slides render as a card over the app background, so the browser
  // bars should keep their default tint there.
  useImmersiveThemeColor(isEdgeSlide ? null : colors.bg);

  const onShare = () => {
    if (sharing.current) {
      return;
    }
    sharing.current = true;

    const computed =
      player.stageRef.current === null
        ? null
        : getComputedStyle(player.stageRef.current);
    const shareTheme: ShareTheme =
      computed === null
        ? {
            bg: colors.bg,
            fg: colors.fg,
            accent: colors.accent,
            danger: colors.danger,
            decoration: settings.decoration,
            slideIndex: index,
          }
        : {
            bg: cssVariable(computed, "--slide-bg", colors.bg),
            fg: cssVariable(computed, "--slide-fg", colors.fg),
            accent: cssVariable(computed, "--hl", colors.accent),
            danger: cssVariable(computed, "--red", colors.danger),
            decoration: settings.decoration,
            slideIndex: index,
          };

    void shareWrapped(data, shareTheme).finally(() => {
      sharing.current = false;
    });
  };

  const onRestart = () => {
    player.goto(0);
  };

  const stageStyle: StageStyle = {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    borderRadius: "18px",
    background: colors.bg,
    color: colors.fg,
    boxShadow: "0 30px 80px -20px rgba(0,0,0,.5)",
    "--slide-bg": colors.bg,
    "--slide-fg": colors.fg,
    "--hl": colors.accent,
    "--pen": colors.accent,
    "--red": colors.danger,
    "--paper": "#ffffff",
    "--fd": "var(--font-display)",
    "--fm": "var(--font-sans)",
  };

  return (
    <Shell>
      <div
        ref={player.stageRef}
        className={["wrapped-stage", isEdgeSlide ? "is-edge" : ""].join(" ")}
        style={stageStyle}
      >
        <WrappedDecorations
          kind={settings.decoration}
          fg={colors.fg}
          danger={colors.danger}
          idx={index}
        />

        {/* Readability vignette: tints the edges so text stays legible over
            decorations without muddying the centre. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background:
              "radial-gradient(120% 92% at 50% 42%, transparent 54%, color-mix(in srgb, var(--slide-bg) 62%, transparent) 100%)",
          }}
        />

        <WrappedChrome
          progressStyle={settings.progress}
          idx={index}
          count={count}
          yearLabel={data.season.year_label}
          dark={isDark(colors.bg)}
          onSeek={player.goto}
          onSkip={() => {
            player.goto(count - 1);
          }}
          onLogoClick={onLogoClick}
        />

        {/* Tap zones: left = back (32%), right = forward (68%). */}
        <div
          {...player.leftHold}
          style={{
            position: "absolute",
            left: 0,
            top: "72px",
            bottom: 0,
            width: "32%",
            zIndex: 3,
          }}
        />
        <div
          {...player.rightHold}
          style={{
            position: "absolute",
            right: 0,
            top: "72px",
            bottom: 0,
            width: "68%",
            zIndex: 3,
          }}
        />

        {/* Slide canvas — keyed by index so entrance animations replay. */}
        <div
          key={index}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            padding: "104px 30px 40px",
            display: "flex",
            flexDirection: "column",
            pointerEvents: "none",
            color: "var(--slide-fg, #fff)",
          }}
        >
          <Slide data={data} onShare={onShare} onRestart={onRestart} />
        </div>
      </div>
    </Shell>
  );
}

export function WrappedStory({
  data,
  settings,
  onLogoClick,
}: {
  data: WrappedData;
  settings: WrappedSettings;
  onLogoClick?: () => void;
}) {
  if (!isWrappedStoryData(data)) {
    return (
      <Shell>
        <div
          className="wrapped-empty-stage"
          style={
            {
              flex: 1,
              position: "relative",
              overflow: "hidden",
              borderRadius: "18px",
              background: "#15171c",
              boxShadow: "0 30px 80px -20px rgba(0,0,0,.5)",
              minHeight: "min(720px, calc(100dvh - 8rem))",
              "--fd": "var(--font-display)",
              "--fm": "var(--font-sans)",
            } as StageStyle
          }
        >
          <WrappedEmptyState
            isGlobal={data.is_global === true}
            season={data.season}
          />
        </div>
      </Shell>
    );
  }

  return (
    <StoryPlayer data={data} settings={settings} onLogoClick={onLogoClick} />
  );
}
