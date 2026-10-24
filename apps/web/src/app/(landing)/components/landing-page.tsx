"use client";

import { useEffect, useRef, useState } from "react";

import type { GitHubContributor } from "@/lib/contributors";
import { cn } from "@/lib/utils";

import { useGuestStart } from "./hooks/use-guest-start";
import "./landing.css";
import { Faq } from "./sections/faq";
import { Finale } from "./sections/finale";
import { Hero } from "./sections/hero";
import { LandingNav } from "./sections/landing-nav";
import { LandingTableOfContents } from "./sections/landing-table-of-contents";
import { ProductShowcase } from "./sections/product-showcase/product-showcase";
import { Team } from "./sections/team";
import { Timeline } from "./sections/timeline";
import { FOCUS_RING } from "./ui/focus";

/**
 * The marketing page shown to anonymous visitors at `/`.
 *
 * This component is composition only. Copy lives in `landing-content.ts`, the
 * scroll choreography in `hooks/`, the 3D hero in `scene/`, and the handful of
 * rules that cannot be utilities in `landing.css`.
 */
export function LandingPage({
  contributors,
  isAuthenticated,
}: {
  /** Unresolved: the team rail streams in rather than holding up the hero. */
  contributors: Promise<GitHubContributor[]>;
  /** Signed-in visitors only reach the page at `/?landing=true`. */
  isAuthenticated: boolean;
}): React.JSX.Element {
  const heroReference = useRef<HTMLElement>(null);
  const { isStarting, start } = useGuestStart();
  const [isHeroNavGone, setIsHeroNavGone] = useState(false);

  // The hero header sits at the top of the hero's stage (sticky on desktop).
  // The compact bar takes over as soon as that top leaves the viewport, so
  // the two cross over. Measured on scroll rather than observed: the header
  // lives inside the Bubble's html-in-canvas subtree, which intersection
  // observers do not track reliably.
  useEffect(() => {
    const stage = heroReference.current?.querySelector(":scope > div");
    if (!(stage instanceof HTMLElement)) {
      return;
    }
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      setIsHeroNavGone(stage.getBoundingClientRect().top < 0);
    };
    const schedule = (): void => {
      frame ||= window.requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div
      // `data-landing-page` is what the app-shell overrides key off.
      data-landing-page
      className={cn(
        "group/landing bg-background text-foreground w-full min-w-0 overflow-clip",
        // Tapping a control on the page should not flash the platform highlight.
        "[&_a]:[-webkit-tap-highlight-color:transparent] [&_button]:[-webkit-tap-highlight-color:transparent]",
      )}
    >
      <a
        href="#features"
        className={cn(
          "bg-background text-foreground fixed top-2 left-2 z-[110] -translate-y-[calc(100%+1rem)] rounded-md p-3 focus:translate-y-0",
          FOCUS_RING,
        )}
      >
        Przejdź do treści
      </a>
      <LandingTableOfContents />
      <LandingNav
        variant="compact"
        hidden={!isHeroNavGone}
        isAuthenticated={isAuthenticated}
        isStarting={isStarting}
        onStart={start}
      />
      <Hero
        heroReference={heroReference}
        nav={
          <LandingNav
            isAuthenticated={isAuthenticated}
            isStarting={isStarting}
            onStart={start}
          />
        }
      />
      <ProductShowcase />
      <Faq />
      <Timeline />
      <Team contributors={contributors} />
      <Finale
        isAuthenticated={isAuthenticated}
        isStarting={isStarting}
        onStart={start}
      />
    </div>
  );
}
