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
import { NAV_VARIABLES } from "./sections/landing-nav-variables";
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
  const dockReference = useRef<HTMLDivElement>(null);
  const { isStarting, start } = useGuestStart();

  // The hero header sits at the top of the hero's stage (sticky on desktop).
  // From the first pixel that top is gone the compact bar's dock shows in
  // its place with the same geometry; once the hero header would have left
  // entirely the bar shrinks to its own size (`data-settled`). Where
  // scroll-driven animations exist, landing.css does both from the hero's
  // view timeline, in step with the compositor at any scroll speed and
  // before hydration; this handler is the fallback for the rest and owns
  // what CSS cannot: inertness, the hero header's visibility and the
  // hand-back mid-shrink. It reads one rect per scroll and writes only when
  // the state flips, so nothing inside the Bubble's html-in-canvas subtree
  // changes while the page scrolls.
  useEffect(() => {
    const stage = heroReference.current?.querySelector(":scope > div");
    const dock = dockReference.current;
    const compactNav =
      dock?.querySelector<HTMLElement>('[data-landing-nav="compact"]') ?? null;
    if (
      !(stage instanceof HTMLElement) ||
      dock === null ||
      compactNav === null
    ) {
      return;
    }
    let heroNavHeight = 0;
    let wasGone: boolean | null = null;
    let wasSettled: boolean | null = null;
    const remeasure = (): void => {
      // The compact bar shares the hero header's geometry: its hero height
      // is the one dimension that never changes with the shrink.
      const heroHeight =
        getComputedStyle(compactNav).getPropertyValue("--lp-nav-hero-h");
      heroNavHeight =
        Number.parseFloat(heroHeight) *
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    };
    const measure = (): void => {
      if (!(heroNavHeight > 0)) {
        // The stylesheet can land after the first pass.
        remeasure();
      }
      const scrolledPast = -stage.getBoundingClientRect().top;
      const gone = scrolledPast >= 1;
      if (gone !== wasGone) {
        const heroNavs = stage.querySelectorAll<HTMLElement>(
          '[data-landing-nav="hero"]',
        );
        // Handing back mid-shrink (a quick scroll up): the hero header picks
        // up the bar's current size and finishes the shrink back itself.
        if (wasGone === true && !gone) {
          const current = Number.parseFloat(
            getComputedStyle(compactNav).getPropertyValue("--lp-nav-t"),
          );
          if (current > 0.001) {
            for (const heroNav of heroNavs) {
              heroNav.animate(
                [{ "--lp-nav-t": current }, { "--lp-nav-t": 0 }] as Keyframe[],
                {
                  duration: 480 * current,
                  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                },
              );
            }
          }
        }
        wasGone = gone;
        for (const heroNav of heroNavs) {
          heroNav.style.visibility = gone ? "hidden" : "";
          heroNav.inert = gone;
          heroNav.setAttribute("aria-hidden", String(gone));
        }
        dock.style.opacity = gone ? "1" : "";
        dock.style.pointerEvents = gone ? "auto" : "";
        compactNav.inert = !gone;
        compactNav.setAttribute("aria-hidden", String(!gone));
      }
      const settled = scrolledPast >= heroNavHeight + 1;
      if (settled !== wasSettled) {
        wasSettled = settled;
        compactNav.dataset.settled = String(settled);
      }
    };
    const onResize = (): void => {
      remeasure();
      measure();
    };
    // The first pass lands on whatever the page loaded at, without easing.
    compactNav.style.transition = "none";
    onResize();
    const frame = window.requestAnimationFrame(() => {
      compactNav.style.transition = "";
    });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      // `data-landing-page` is what the app-shell overrides key off.
      data-landing-page
      className={cn(
        "group/landing bg-background text-foreground w-full min-w-0 overflow-clip",
        // Lets the compact bar's dock follow the hero's view timeline.
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
      {/* Shown by landing.css (scroll-driven) or the effect above. */}
      <div
        ref={dockReference}
        data-landing-nav-dock
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-50 opacity-0",
          // Its settle range is one hero-header height into the swap.
          NAV_VARIABLES,
        )}
      >
        <LandingNav
          variant="compact"
          isAuthenticated={isAuthenticated}
          isStarting={isStarting}
          onStart={start}
        />
      </div>
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
