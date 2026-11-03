"use client";

import { useEffect, useRef, useState } from "react";

import type { GitHubContributor } from "@/lib/contributors";
import { cn } from "@/lib/utils";

import type { LandingBlogPost } from "../lib/blog";
import { useGuestStart } from "./hooks/use-guest-start";
import "./landing.css";
import { Faq } from "./sections/faq";
import { Finale } from "./sections/finale";
import { Hero } from "./sections/hero";
import { LandingNav } from "./sections/landing-nav";
import { NAV_HOVER_NONE } from "./sections/landing-nav-hover";
import type { NavHover } from "./sections/landing-nav-hover";
import { Perks } from "./sections/perks";
import { ProductShowcase } from "./sections/product-showcase/product-showcase";
import { Team } from "./sections/team";
import { Timeline } from "./sections/timeline";
import { LandingTableOfContents } from "./sections/toc/landing-table-of-contents";
import { FOCUS_RING } from "./ui/focus";

/** The marketing page shown to anonymous visitors at `/`. */
export function LandingPage({
  blogPosts,
  contributors,
  isAuthenticated,
}: {
  /** Unresolved: the update note lists them once they arrive. */
  blogPosts: Promise<LandingBlogPost[]>;
  /** Unresolved: the team rail streams in rather than holding up the hero. */
  contributors: Promise<GitHubContributor[]>;
  /** Signed-in visitors only reach the page at `/?landing=true`. */
  isAuthenticated: boolean;
}): React.JSX.Element {
  const heroReference = useRef<HTMLElement>(null);
  const { isStarting, start } = useGuestStart();
  // Hover on the real header, mirrored into the copy the Bubble refracts.
  const [navHover, setNavHover] = useState<NavHover>(NAV_HOVER_NONE);

  // Fallback for the header shrink where scroll-driven animations are missing.
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
            onHoverChange={(patch) => {
              // Merged on the latest state: a link's leave and a control's
              // enter can land in the same batch.
              setNavHover((current) => ({ ...current, ...patch }));
            }}
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
      {/*
       * No Suspense around these: a boundary this large is outlined by the
       * server renderer, so the section would stream in after the shell with
       * zero height first, breaking scroll restoration on reload.
       */}
      <div className="relative">
        <ProductShowcase />
        <Faq />
        <Timeline blogPosts={blogPosts} />
      </div>
      <Team contributors={contributors} />
      <Perks />
      <Finale
        isAuthenticated={isAuthenticated}
        isStarting={isStarting}
        onStart={start}
      />
    </div>
  );
}
