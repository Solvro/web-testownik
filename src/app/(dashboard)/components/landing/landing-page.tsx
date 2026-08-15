"use client";

import { useRef } from "react";

import type { GitHubContributor } from "@/lib/contributors";
import { cn } from "@/lib/utils";

import { useGuestStart } from "./hooks/use-guest-start";
import { useHeroProgress } from "./hooks/use-hero-progress";
import { landingFontVariables } from "./landing-fonts";
import "./landing.css";
import { Finale } from "./sections/finale";
import { Hero } from "./sections/hero";
import { LandingTableOfContents } from "./sections/landing-table-of-contents";
import { ProductShowcase } from "./sections/product-showcase/product-showcase";
import { Team } from "./sections/team";
import { Timeline } from "./sections/timeline";

/**
 * The marketing page shown to anonymous visitors at `/`.
 *
 * This component is composition only. Copy lives in `landing-content.ts`, the
 * scroll choreography in `hooks/`, the 3D hero in `scene/`, and the handful of
 * rules that cannot be utilities in `landing.css`.
 */
export function LandingPage({
  contributors,
}: {
  /** Unresolved: the team rail streams in rather than holding up the hero. */
  contributors: Promise<GitHubContributor[]>;
}): React.JSX.Element {
  const heroReference = useRef<HTMLElement>(null);
  const { isStarting, start } = useGuestStart();

  useHeroProgress(heroReference);

  return (
    <div
      // `data-landing-page` is what the app-shell overrides key off.
      data-landing-page
      className={cn(
        "group/landing bg-background text-foreground w-full min-w-0 overflow-clip",
        // Tapping a control on the page should not flash the platform highlight.
        "[&_a]:[-webkit-tap-highlight-color:transparent] [&_button]:[-webkit-tap-highlight-color:transparent]",
        landingFontVariables,
      )}
    >
      <LandingTableOfContents />
      <Hero
        heroReference={heroReference}
        isStarting={isStarting}
        onStart={start}
      />
      <ProductShowcase />
      <Timeline />
      <Team contributors={contributors} />
      <Finale isStarting={isStarting} onStart={start} />
    </div>
  );
}
