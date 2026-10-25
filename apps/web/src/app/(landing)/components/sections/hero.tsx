"use client";

import { ChevronDown } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  HERO_PROGRESS,
  attachHeroProgress,
  setHeroProgressHold,
} from "../hero-progress";
import { useHeroProgress } from "../hooks/use-hero-progress";
import { useIsDesktopViewport } from "../hooks/use-prefers-reduced-motion";
import { useDeviceCoverPlacement } from "../scene/device-cover-placement";
import { DeviceSceneBackdrop } from "../scene/device-scene-backdrop";
import { DEVICE_COVER_CLASS } from "../scene/scene-classes";
import { FOCUS_RING } from "../ui/focus";
import { HeroBadges } from "./hero-badges";
import { HeroFade } from "./hero-fade";
import { HeroPhone } from "./hero-phone";
import { HeroScrollHint } from "./hero-scroll-hint";

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

/** The pre-mount cover, placed by the same solver as the stack's own. */
function StaticDeviceCover(): React.JSX.Element {
  const coverReference = useRef<HTMLDivElement>(null);
  useDeviceCoverPlacement(coverReference);
  return <div ref={coverReference} className={DEVICE_COVER_CLASS} />;
}

/**
 * The header, hero copy and "Poznaj produkt" link, rendered exactly once
 * whichever stage hosts it. Below `lg` it flows; at `lg` it is laid out
 * absolutely over the sticky stage. `visual` sits between copy and link.
 */
function HeroContent({
  nav,
  visual,
  isStatic = false,
}: {
  nav?: ReactNode;
  visual?: ReactNode;
  isStatic?: boolean;
}): React.JSX.Element {
  return (
    <>
      {nav}

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
        <h1 className="max-w-[26rem] text-[clamp(2.2rem,10vw,3.5rem)] leading-[0.95] font-extrabold tracking-tight lg:flex lg:max-w-none lg:flex-col lg:text-[clamp(3.3rem,6.25vw,7.35rem)] lg:leading-[0.78] lg:whitespace-nowrap">
          Zapomnij o{" "}
          <em className="text-primary not-italic">problemach z nauką</em>
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
          className="size-4 animate-[lp-nudge_1.6s_ease-in-out_infinite] motion-reduce:animate-none"
        />
        Poznaj produkt
      </a>
    </>
  );
}

export function Hero({
  heroReference,
  nav,
}: {
  heroReference: React.RefObject<HTMLElement | null>;
  /** The hero variant of the header, refracted by the Bubble on desktop. */
  nav?: ReactNode;
}): React.JSX.Element {
  // False on the server and during hydration: the server markup is always the
  // static hero below, so there is nothing to mismatch.
  const isDesktop = useIsDesktopViewport();
  const [isStatic, setIsStatic] = useState(false);
  const [isStageReady, setIsStageReady] = useState(false);
  const [isStageSettled, setIsStageSettled] = useState(false);
  useHeroProgress(heroReference, isDesktop && !isStatic);

  // Until the stack is ready the copy, badges and hint stay at the closed
  // pose whatever the scroll position, like the scene under its cover; the
  // static fallback has no scene to wait for.
  const holdProgress = isDesktop && !isStatic && !isStageReady;
  useEffect(() => {
    setHeroProgressHold(holdProgress);
    return () => {
      setHeroProgressHold(false);
    };
  }, [holdProgress]);

  // Once ready, the stack opens from the closed pose to the scrolled progress
  // and publishes each frame to the DOM targets itself (see
  // `setHeroProgressOverride`); the scroll-driven wordmark waits for that
  // travel to finish (cover handoff plus the longest catch-up).
  useEffect(() => {
    if (!isStageReady) {
      setIsStageSettled(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setIsStageSettled(true);
    }, 1400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [isStageReady]);

  /*
   * Phones keep this for good. On desktop it is the server render and the
   * Suspense fallback; the placeholder holds the device cover, the glow and
   * the study chips in exactly the spots the stage shows them at the closed
   * pose, so the stage mounting does not move or add anything.
   * Neither visual costs the other viewport a request: the phone loads its
   * screen only below `lg`, and a hidden element never fetches a background.
   */
  const staticHero = (
    <div className="lp-hero-grid relative px-4 pt-[6.5rem] pb-8 lg:absolute lg:inset-0 lg:p-0">
      <HeroContent
        nav={nav}
        visual={
          <>
            <HeroPhone className="lg:hidden" />
            <div
              aria-hidden="true"
              className="@container-[size] pointer-events-none absolute inset-x-0 top-[5.3rem] bottom-0 z-30 hidden lg:block"
            >
              <DeviceSceneBackdrop isStatic />
              <StaticDeviceCover />
              <HeroBadges isStatic />
              <HeroScrollHint isStatic />
            </div>
          </>
        }
      />
      <HeroFade />
    </div>
  );

  return (
    <section
      id="start"
      ref={heroReference}
      data-hero-static={isStatic}
      data-hero-ready={isStageReady}
      data-hero-settled={isStageSettled}
      className={cn(
        // Names the view timeline the open-laptop wordmark and the header
        // swap animate on. The inset would otherwise default to the root's
        // scroll padding, and the `view-timeline` shorthand would reset it
        // in Chrome.
        "relative scroll-mt-4 [view-timeline-inset:0] [view-timeline-name:--lp-hero]",
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
              onReady={() => {
                setIsStageReady(true);
              }}
            >
              <HeroContent nav={nav} isStatic={isStatic} />
            </HeroDesktopStage>
          </Suspense>
        ) : (
          staticHero
        )}
      </div>
    </section>
  );
}
