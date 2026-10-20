"use client";

import { ChevronDown } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { Eyebrow } from "../components/typography";
import { HERO_PROGRESS, attachHeroProgress } from "../hero-progress";
import { useHeroProgress } from "../hooks/use-hero-progress";
import { useIsDesktopViewport } from "../hooks/use-prefers-reduced-motion";
import { DEVICE_COVER_CLASS } from "../scene/scene-classes";
import { HeroPhone } from "./hero-phone";
import { LandingNav } from "./landing-nav";

/*
 * Bubble, WebGL scene and scroll progress. Requested only once the desktop
 * query matches, so phones never fetch the chunk. Plain `lazy` rather than
 * `next/dynamic`: with `ssr: false` the latter forces its own Suspense boundary
 * whose fallback cannot receive props, which would blank the shared copy while
 * the chunk loads. Here the fallback is the static hero itself.
 */
const HeroDesktopStage = lazy(async () => {
  const loaded = await import("./hero-desktop-stage");
  return { default: loaded.HeroDesktopStage };
});

/**
 * On desktop the copy leaves as the laptop opens. A plain CSS expression over
 * the published progress, so it follows the scroll without a React render per
 * frame. Below `lg` the progress publisher resets the copy to 0.
 */
const copyStyle: CSSProperties = {
  opacity: `clamp(0, calc(1 - ${HERO_PROGRESS} * 3.8), 1)`,
  transform: `translateY(calc(${HERO_PROGRESS} * -4rem))`,
};

/**
 * The hero copy, navigation and "Poznaj produkt" link, rendered exactly once
 * whichever stage hosts it. Below `lg` it flows; at `lg` it is laid out
 * absolutely over the sticky stage. `visual` sits between copy and link.
 */
function HeroContent({
  isStarting,
  onStart,
  visual,
  isStatic = false,
}: {
  isStarting: boolean;
  onStart: () => void;
  visual?: ReactNode;
  isStatic?: boolean;
}): React.JSX.Element {
  return (
    <>
      <LandingNav isStarting={isStarting} onStart={onStart} />

      <div
        data-hero-progress={isStatic ? undefined : true}
        ref={isStatic ? undefined : attachHeroProgress}
        style={isStatic ? undefined : copyStyle}
        className={cn(
          "lg:z-10 lg:max-w-[min(66rem,82vw)]",
          isStatic
            ? "lg:relative lg:ml-[clamp(1.5rem,4vw,4.5rem)]"
            : "lg:absolute lg:top-[calc(5.3rem+clamp(2rem,5vh,4rem))] lg:left-[clamp(1.5rem,4vw,4.5rem)]",
        )}
      >
        <Eyebrow>TESTOWNIK / TEN OD ANTKA</Eyebrow>
        <h1 className="mt-3 max-w-[26rem] text-[clamp(2.2rem,10vw,3.5rem)] leading-[0.95] font-extrabold tracking-tight lg:flex lg:max-w-none lg:flex-col lg:text-[clamp(3.3rem,6.25vw,7.35rem)] lg:leading-[0.78] lg:whitespace-nowrap">
          Zapomnij o{" "}
          <em className="text-landing-primary not-italic">
            problemach z nauką
          </em>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-[28rem] text-sm leading-relaxed text-balance lg:mt-6 lg:max-w-[32rem] lg:text-[clamp(0.95rem,1.3vw,1.18rem)] lg:leading-[1.55]">
          Twórz i&nbsp;rozwiązuj quizy, śledź postępy i&nbsp;oceny oraz ucz się
          razem ze znajomymi.
        </p>
      </div>

      {visual}

      <a
        href="#features"
        className={cn(
          "text-muted-foreground mt-6 ml-auto flex min-h-11 w-fit items-center gap-[0.45rem] rounded-xs text-[0.66rem] font-bold tracking-[0.1em] uppercase",
          "lg:absolute lg:right-[2.2rem] lg:bottom-[1.15rem] lg:z-20 lg:mt-0",
          FOCUS_RING,
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className="animate-lp-nudge size-4 motion-reduce:animate-none"
        />
        Poznaj produkt
      </a>
    </>
  );
}

export function Hero({
  heroReference,
  isStarting,
  onStart,
}: {
  heroReference: React.RefObject<HTMLElement | null>;
  isStarting: boolean;
  onStart: () => void;
}): React.JSX.Element {
  // False on the server and during hydration: the server markup is always the
  // static hero below, so there is nothing to mismatch.
  const isDesktop = useIsDesktopViewport();
  const [isStatic, setIsStatic] = useState(false);
  useHeroProgress(heroReference, isDesktop && !isStatic);

  /*
   * Phones keep this for good. On desktop it is the server render and the
   * Suspense fallback; the placeholder holds the device cover in exactly the
   * spot DeviceStack shows it, so the stage mounting does not move anything.
   * Neither visual costs the other viewport a request: the phone loads its
   * screen only below `lg`, and a hidden element never fetches a background.
   */
  const staticHero = (
    <div className="lp-hero-grid relative px-4 pt-[6.5rem] pb-8 lg:absolute lg:inset-0 lg:p-0">
      <HeroContent
        isStarting={isStarting}
        onStart={onStart}
        visual={
          <>
            <HeroPhone className="lg:hidden" />
            <div
              aria-hidden="true"
              className="@container-[size] pointer-events-none absolute inset-x-0 top-[5.3rem] bottom-0 z-30 hidden lg:block"
            >
              <div className={DEVICE_COVER_CLASS} />
            </div>
          </>
        }
      />
    </div>
  );

  return (
    <section
      id="start"
      ref={heroReference}
      data-hero-static={isStatic}
      className={cn(
        "relative scroll-mt-4",
        isStatic
          ? "lg:h-[100svh] lg:min-h-[36rem]"
          : "lg:h-[300vh] lg:min-h-[190rem]",
      )}
    >
      {/* React hoists this into <head>; only wide viewports fetch the model. */}
      <link
        rel="preload"
        href="/models/device-stack.glb"
        as="fetch"
        type="model/gltf-binary"
        crossOrigin="anonymous"
        media="(min-width: 1024px)"
      />
      <div
        className={cn(
          "relative lg:h-[100svh] lg:overflow-hidden",
          isStatic
            ? "lg:h-[100svh] lg:min-h-[36rem]"
            : "lg:sticky lg:top-0 lg:min-h-[42rem]",
        )}
      >
        {isDesktop ? (
          <Suspense fallback={staticHero}>
            <HeroDesktopStage
              isStatic={isStatic}
              onRestored={() => {
                setIsStatic(false);
              }}
              onUnavailable={() => {
                setIsStatic(true);
              }}
            >
              <HeroContent
                isStarting={isStarting}
                onStart={onStart}
                isStatic={isStatic}
              />
            </HeroDesktopStage>
          </Suspense>
        ) : (
          staticHero
        )}
      </div>
    </section>
  );
}
