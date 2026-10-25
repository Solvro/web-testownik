"use client";

import { useEffect, useRef } from "react";

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
  const compactNavReference = useRef<HTMLElement>(null);
  const { isStarting, start } = useGuestStart();

  // The compact bar slides in once the hero header has scrolled out of the
  // hero's stage (sticky on desktop). Where scroll-driven animations exist
  // landing.css does that from the hero's view timeline, on the compositor
  // and already at first paint; this handler is the fallback for the rest
  // and keeps the bar inert while it waits above the viewport. One rect per
  // scroll, written only when the state flips.
  useEffect(() => {
    const stage = heroReference.current?.querySelector(":scope > div");
    const compactNav = compactNavReference.current;
    if (!(stage instanceof HTMLElement) || compactNav === null) {
      return;
    }
    let wasShown: boolean | null = null;
    const measure = (): void => {
      const heroHeight =
        Number.parseFloat(
          getComputedStyle(compactNav).getPropertyValue("--lp-nav-hero-h"),
        ) *
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const shown = -stage.getBoundingClientRect().top >= heroHeight;
      if (shown !== wasShown) {
        wasShown = shown;
        compactNav.dataset.shown = String(shown);
        compactNav.inert = !shown;
        compactNav.setAttribute("aria-hidden", String(!shown));
      }
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      // `data-landing-page` is what the app-shell overrides key off.
      data-landing-page
      className={cn(
        "group/landing bg-background text-foreground w-full min-w-0 overflow-clip",
        // Lets the compact bar follow the hero's view timeline.
        "[timeline-scope:--lp-hero]",
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
