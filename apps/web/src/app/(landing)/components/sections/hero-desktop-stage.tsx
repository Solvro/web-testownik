"use client";

import Image from "next/image";
import { useEffect, useEffectEvent } from "react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HERO_PROGRESS, attachHeroProgress } from "../hero-progress";
import { wordmarkDark, wordmarkLight } from "../logos";
import { DeviceScene } from "../scene/device-scene";
import { HeroBubble } from "../ui/hero-bubble";
import { Eyebrow } from "../ui/typography";
import { HeroBadges } from "./hero-badges";
import { HeroFade } from "./hero-fade";

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
 * `children` is the shared hero copy and header. It renders inside the Bubble
 * so the droplet refracts it.
 */
export function HeroDesktopStage({
  children,
  isStatic,
  onUnavailable,
  onRestored,
}: {
  children: ReactNode;
  isStatic: boolean;
  onUnavailable: () => void;
  onRestored: () => void;
}): React.JSX.Element {
  const resetFallback = useEffectEvent(onRestored);
  useEffect(() => {
    // A new desktop scene gets a fresh chance after a mobile viewport visit.
    // DeviceStack retains the page-wide creation-failure budget.
    resetFallback();
  }, []);

  return (
    <>
      {/*
       * The Bubble is its own stacking context (z-1) so the droplet can paint
       * above the header it refracts while the whole bubble still stays
       * beneath the device layer.
       */}
      <HeroBubble className="lp-bubble-capture absolute! inset-0 z-1">
        {/* Over the grid, beneath the copy and the scroll hint. */}
        <HeroFade />
        {/* Keep the copy mounted across context loss and restoration. */}
        <div
          className={
            isStatic
              ? "grid h-full grid-rows-[auto_minmax(0,1fr)] gap-6 pt-[calc(5.3rem+clamp(2rem,5vh,4rem))] pb-16"
              : "contents"
          }
        >
          {children}
          {isStatic ? (
            <div className="relative min-h-0" data-hero-static-visual>
              <HeroBadges isStatic />
              <Image
                src="/models/testownik-device-stack-open-light-v1.webp"
                alt=""
                fill
                sizes="100vw"
                className="object-contain dark:hidden"
              />
              <Image
                src="/models/testownik-device-stack-open-dark-v1.webp"
                alt=""
                fill
                sizes="100vw"
                className="hidden object-contain dark:block"
              />
            </div>
          ) : null}
        </div>

        <div className="absolute inset-x-0 top-[5.3rem] bottom-0">
          {isStatic ? null : <HeroBadges />}

          {isStatic ? null : (
            <div
              aria-hidden="true"
              data-hero-progress
              ref={attachHeroProgress}
              style={openLogoStyle}
              className="lp-hero-open-logo absolute top-[clamp(5.5rem,10vh,8rem)] left-1/2 z-6 w-[clamp(13rem,17vw,20rem)]"
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
          )}

          {isStatic ? null : (
            <div
              aria-hidden="true"
              className="absolute bottom-[1.3rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[0.8rem]"
            >
              <Eyebrow>PRZEWIŃ</Eyebrow>
              <span className="bg-border relative block h-px w-36 overflow-hidden">
                <span
                  data-hero-progress
                  ref={attachHeroProgress}
                  style={progressBarStyle}
                  className="bg-primary absolute inset-0 origin-left"
                />
              </span>
              <Eyebrow>OTWÓRZ TESTOWNIK</Eyebrow>
            </div>
          )}
        </div>
      </HeroBubble>

      {/*
       * Outside the Bubble on purpose. The Bubble refracts through
       * html-in-canvas, which cannot host a nested WebGL canvas and would
       * rasterise the device screens; as a sibling above it the whole scene
       * stays sharp and the droplet passes underneath. Keep it mounted while
       * hidden so its context-restoration listener can return to the live hero.
       */}
      <div
        aria-hidden={isStatic ? true : undefined}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-[5.3rem] bottom-0 z-30",
          isStatic && "invisible",
        )}
      >
        <DeviceScene
          isStatic={isStatic}
          onUnavailable={onUnavailable}
          onRestored={onRestored}
        />
      </div>
    </>
  );
}
