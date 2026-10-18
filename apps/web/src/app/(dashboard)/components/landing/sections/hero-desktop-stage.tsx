"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import { HeroBubble } from "../components/hero-bubble";
import { Eyebrow } from "../components/typography";
import { HERO_PROGRESS } from "../hero-progress";
import { wordmarkDark, wordmarkLight } from "../logos";
import { DeviceScene } from "../scene/device-scene";
import { HeroBadges } from "./hero-badges";

const progressBarStyle: CSSProperties = {
  transform: `scaleX(${HERO_PROGRESS})`,
};

const openLogoStyle: CSSProperties = {
  opacity: `clamp(0, calc((${HERO_PROGRESS} - 0.6) * 6), 1)`,
  transform: `translate(-50%, calc((1 - ${HERO_PROGRESS}) * 1.5rem)) scale(calc(0.96 + ${HERO_PROGRESS} * 0.04))`,
};

/**
 * Everything the hero only does at `lg` and above: the CanvasUI Bubble, the
 * WebGL device scene and everything that reads the scroll progress (which
 * `Hero` itself publishes). `Hero` loads this
 * module lazily once `DESKTOP_STAGE_QUERY` matches, so smaller viewports never
 * download it.
 *
 * `children` is the shared hero copy. It renders inside the Bubble so the
 * droplet refracts it with the rest of the header.
 */
export function HeroDesktopStage({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <>
      {/*
       * The Bubble is its own stacking context (z-1) so the droplet can paint
       * above the header it refracts while the whole bubble still stays
       * beneath the device layer.
       */}
      <HeroBubble className="lp-bubble-capture absolute! inset-0 z-1">
        {children}

        <div className="absolute inset-x-0 top-[5.3rem] bottom-0">
          <HeroBadges />

          <div
            aria-hidden="true"
            style={openLogoStyle}
            className="absolute top-[clamp(5.5rem,10vh,8rem)] left-1/2 z-6 w-[clamp(13rem,17vw,20rem)] transition-opacity duration-[120ms]"
          >
            <Image
              src={wordmarkLight}
              alt=""
              className="block h-auto w-full dark:hidden"
            />
            <Image
              src={wordmarkDark}
              alt=""
              className="hidden h-auto w-full dark:block"
            />
          </div>

          <div
            aria-hidden="true"
            className="absolute bottom-[1.3rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[0.8rem]"
          >
            <Eyebrow>PRZEWIŃ</Eyebrow>
            <span className="bg-border relative block h-px w-36 overflow-hidden">
              <span
                style={progressBarStyle}
                className="bg-primary absolute inset-0 origin-left"
              />
            </span>
            <Eyebrow>OTWÓRZ TESTOWNIK</Eyebrow>
          </div>
        </div>
      </HeroBubble>

      {/*
       * Outside the Bubble on purpose. The Bubble refracts through
       * html-in-canvas, which cannot host a nested WebGL canvas and would
       * rasterise the device screens; as a sibling above it the whole scene
       * stays sharp and the droplet passes underneath.
       */}
      <div className="pointer-events-none absolute inset-x-0 top-[5.3rem] bottom-0 z-30">
        <DeviceScene />
      </div>
    </>
  );
}
