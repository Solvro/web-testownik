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
  const heroNavReference = useRef<HTMLElement>(null);
  const compactNavReference = useRef<HTMLElement>(null);
  const { isStarting, start } = useGuestStart();
  const [isHeroNavGone, setIsHeroNavGone] = useState(false);
  const [isNavSettled, setIsNavSettled] = useState(false);

  // The hero header sits at the top of the hero's stage (sticky on desktop).
  // As soon as that top leaves the viewport the compact bar takes its place
  // with the same geometry; once the hero header would have left entirely
  // the bar shrinks to its own size (`settled`). Measured on scroll rather
  // than observed: the header lives inside the Bubble's html-in-canvas
  // subtree, which intersection observers do not track reliably.
  useEffect(() => {
    const stage = heroReference.current?.querySelector(":scope > div");
    if (!(stage instanceof HTMLElement)) {
      return;
    }
    let frame = 0;
    let wasGone = false;
    const measure = (): void => {
      frame = 0;
      const scrolledPast = -stage.getBoundingClientRect().top;
      const heroNav = heroNavReference.current;
      const compactNav = compactNavReference.current;
      const gone = scrolledPast > 0;
      // Handing back mid-shrink (a quick scroll up): the hero header picks
      // up the bar's current size and finishes the transition itself.
      if (wasGone && !gone && heroNav !== null && compactNav !== null) {
        const current =
          getComputedStyle(compactNav).getPropertyValue("--lp-nav-t");
        if (Number.parseFloat(current) > 0.001) {
          heroNav.style.transition = "none";
          heroNav.style.setProperty("--lp-nav-t", current);
          void heroNav.offsetHeight;
          heroNav.style.transition = "";
          heroNav.style.removeProperty("--lp-nav-t");
        }
      }
      wasGone = gone;
      setIsHeroNavGone(gone);
      setIsNavSettled(scrolledPast >= (heroNav?.offsetHeight ?? 0));
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
        ref={compactNavReference}
        variant="compact"
        hidden={!isHeroNavGone}
        settled={isNavSettled}
        isAuthenticated={isAuthenticated}
        isStarting={isStarting}
        onStart={start}
      />
      <Hero
        heroReference={heroReference}
        nav={
          <LandingNav
            ref={heroNavReference}
            hidden={isHeroNavGone}
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
