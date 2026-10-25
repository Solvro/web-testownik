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
import { NAV_HOVER_NONE } from "./sections/landing-nav-hover";
import type { NavHover } from "./sections/landing-nav-hover";
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
  // Hover on the real header, mirrored into the copy the Bubble refracts.
  const [navHover, setNavHover] = useState<NavHover>(NAV_HOVER_NONE);

  // The header shrinks as the hero's stage leaves the viewport. Where
  // scroll-driven animations exist landing.css does that from the hero's
  // view timeline; this handler is the fallback for the rest. It reads one
  // rect per scroll and writes only when the state flips.
  useEffect(() => {
    const hero = heroReference.current;
    const stage = hero?.querySelector("[data-hero-stage]");
    const nav = hero?.querySelector('[data-landing-nav="fixed"]');
    if (
      hero === null ||
      !(stage instanceof HTMLElement) ||
      !(nav instanceof HTMLElement)
    ) {
      return;
    }
    let wasSettled: boolean | null = null;
    const measure = (): void => {
      const settled = stage.getBoundingClientRect().top <= -1;
      if (settled !== wasSettled) {
        wasSettled = settled;
        nav.dataset.settled = String(settled);
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
      <Hero
        heroReference={heroReference}
        nav={
          <LandingNav
            isAuthenticated={isAuthenticated}
            isStarting={isStarting}
            onStart={start}
            hover={navHover}
            onHoverChange={setNavHover}
          />
        }
        captureNav={
          <LandingNav
            capture
            isAuthenticated={isAuthenticated}
            isStarting={isStarting}
            onStart={start}
            hover={navHover}
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
