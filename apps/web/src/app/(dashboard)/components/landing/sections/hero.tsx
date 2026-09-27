"use client";

import { ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { HeroBubble } from "../components/hero-bubble";
import { Eyebrow } from "../components/typography";
import { HERO_PROGRESS } from "../hero-progress";
import { DeviceScene } from "../scene/device-scene";
import { HeroBadges } from "./hero-badges";
import { LandingNav } from "./landing-nav";

/**
 * The copy leaves as the laptop opens and the call to action arrives in its
 * place. Both are plain CSS expressions over the published hero progress, so
 * they follow the scroll without a React render per frame.
 */
const copyStyle: CSSProperties = {
  opacity: `clamp(0, calc(1 - ${HERO_PROGRESS} * 3.8), 1)`,
  transform: `translateY(calc(${HERO_PROGRESS} * -4rem))`,
};

const progressBarStyle: CSSProperties = {
  transform: `scaleX(${HERO_PROGRESS})`,
};

export function Hero({
  heroReference,
  isStarting,
  onStart,
}: {
  heroReference: React.RefObject<HTMLElement | null>;
  isStarting: boolean;
  onStart: () => void;
}): React.JSX.Element {
  return (
    <section
      id="start"
      ref={heroReference}
      className="relative h-[270vh] min-h-[145rem] scroll-mt-4 [--landing-hero-progress:0] sm:h-[300vh] sm:min-h-[190rem]"
    >
      <div className="sticky top-0 h-[100svh] min-h-[38rem] overflow-hidden sm:min-h-[42rem]">
        {/*
         * The Bubble is its own stacking context (z-1) so the droplet can paint
         * above the header it refracts while the whole bubble still stays
         * beneath the device layer.
         */}
        <HeroBubble className="lp-bubble-capture absolute! inset-0 z-1">
          <LandingNav isStarting={isStarting} onStart={onStart} />

          <div className="absolute inset-x-0 top-[4.5rem] bottom-0 sm:top-[5.3rem]">
            <div
              style={copyStyle}
              className="absolute top-6 left-4 z-10 max-w-[calc(100vw-2rem)] sm:top-[clamp(2rem,5vh,4rem)] sm:left-[clamp(1.5rem,4vw,4.5rem)] sm:max-w-[min(64rem,82vw)]"
            >
              <Eyebrow>TESTOWNIK / TEN OD ANTKA</Eyebrow>
              <h1 className="mt-3 flex flex-col text-[clamp(1.8rem,8vw,3.5rem)] leading-[0.84] font-extrabold tracking-[-0.085em] whitespace-nowrap sm:text-[clamp(3.3rem,6.25vw,7.35rem)] sm:leading-[0.78] sm:tracking-tight">
                Zapomnij o
                <em className="text-primary not-italic">problemach z nauką</em>
              </h1>
              <p className="text-muted-foreground mt-4 max-w-[22rem] text-[0.88rem] leading-[1.55] sm:mt-6 sm:max-w-[32rem] sm:text-[clamp(0.95rem,1.3vw,1.18rem)]">
                Quizy, statystyki, oceny i wspólna nauka - zawsze pod ręką
              </p>
            </div>

            <HeroBadges />

            <div
              aria-hidden="true"
              className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-[0.8rem] sm:bottom-[1.3rem]"
            >
              <Eyebrow>PRZEWIŃ</Eyebrow>
              <span className="bg-border relative block h-px w-16 overflow-hidden sm:w-36">
                <span
                  style={progressBarStyle}
                  className="bg-primary absolute inset-0 origin-left"
                />
              </span>
              <Eyebrow>OTWÓRZ TESTOWNIK</Eyebrow>
            </div>

            <a
              href="#features"
              className={cn(
                "text-muted-foreground absolute right-8 bottom-[1.15rem] z-20 hidden items-center gap-[0.45rem] rounded-xs text-[0.66rem] font-bold tracking-[0.1em] uppercase sm:flex",
                FOCUS_RING,
              )}
            >
              <ChevronDown
                aria-hidden="true"
                className="animate-lp-nudge size-4 motion-reduce:animate-none"
              />
              Poznaj produkt
            </a>
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
      </div>
    </section>
  );
}
