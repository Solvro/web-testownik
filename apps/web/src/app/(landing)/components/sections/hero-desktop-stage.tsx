"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HERO_PROGRESS, attachHeroProgress } from "../hero-progress";
import { wordmarkDark, wordmarkLight } from "../logos";
import { DeviceScene } from "../scene/device-scene";
import { HeroBubble } from "../ui/hero-bubble";
import { HeroBadges } from "./hero-badges";
import { HeroFade } from "./hero-fade";
import { HeroScrollHint } from "./hero-scroll-hint";

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
  onReady,
}: {
  children: ReactNode;
  isStatic: boolean;
  onUnavailable: () => void;
  onRestored: () => void;
  onReady: () => void;
}): React.JSX.Element {
  const resetFallback = useEffectEvent(onRestored);
  const lensStripReference = useRef<HTMLCanvasElement>(null);
  // The droplet canvas sits under the fixed header, so the header can stay
  // above the device layer in every frame. Its top strip is copied here, a
  // canvas above the header, so the droplet still passes over the bar.
  const copyLensStrip = (output: HTMLCanvasElement): void => {
    const strip = lensStripReference.current;
    const context = strip?.getContext("2d") ?? null;
    if (strip === null || context === null) {
      return;
    }
    const height = Math.round(
      (strip.clientHeight * output.width) / Math.max(output.clientWidth, 1),
    );
    if (strip.width !== output.width || strip.height !== height) {
      strip.width = output.width;
      strip.height = height;
    }
    context.clearRect(0, 0, strip.width, strip.height);
    if (height > 0 && output.width > 0) {
      context.drawImage(
        output,
        0,
        0,
        output.width,
        height,
        0,
        0,
        strip.width,
        height,
      );
    }
  };
  useEffect(() => {
    // A new desktop scene gets a fresh chance after a mobile viewport visit.
    // DeviceStack retains the page-wide creation-failure budget.
    resetFallback();
  }, []);

  return (
    <>
      {/*
       * Not a stacking context of its own: landing.css layers its content
       * canvas and its droplet canvas under the fixed header, beneath the
       * device layer.
       */}
      <HeroBubble
        className="lp-bubble-capture absolute! inset-0"
        onRender={copyLensStrip}
      >
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

          {isStatic ? null : <HeroScrollHint />}
        </div>
      </HeroBubble>

      {/* The droplet over the header: 5.3rem is the header's hero height at `lg`. */}
      <canvas
        ref={lensStripReference}
        data-hero-lens-strip
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-90 h-[5.3rem] w-full"
      />

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
          "pointer-events-none absolute inset-x-0 top-[5.3rem] bottom-0 z-70",
          isStatic && "invisible",
        )}
      >
        <DeviceScene
          isStatic={isStatic}
          onUnavailable={onUnavailable}
          onRestored={onRestored}
          onReady={onReady}
        />
      </div>
    </>
  );
}
