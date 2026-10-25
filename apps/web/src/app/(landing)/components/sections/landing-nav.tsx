"use client";

import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { LANDING_SECTIONS } from "../landing-sections";
import { wordmarkDark, wordmarkLight } from "../logos";
import { scrollToLandingSection } from "../scroll-to-section";
import { FOCUS_RING } from "../ui/focus";
import { LandingButton, LandingButtonLink } from "../ui/landing-button";

/*
 * The closing section keeps its TOC entry, but the header already carries the
 * call to action, so it gets no link of its own here.
 */
const SECTION_LINKS = LANDING_SECTIONS.filter(({ id }) => id !== "footer").map(
  ({ id, navLabel }) => ({ href: `#${id}`, label: navLabel }),
);

const START_BUTTON_CLASS = cn(
  "px-[0.9rem] text-[0.78rem] tracking-[0.02em] normal-case sm:px-[1.15rem] sm:text-[0.86rem]",
  "transition-[gap,background-color] duration-300",
  "hover:gap-4",
  "active:translate-y-0 active:shadow-none",
);

/*
 * Every dimension that differs between the hero look and the settled bar is
 * a hero value minus a shrink scaled by `--lp-nav-t` (0 over the hero, 1
 * once settled), registered in landing.css so flipping it transitions every
 * dimension together. It eases only once the visitor has touched the page: a
 * reload restores the scroll position after the first style pass, and the
 * header has to land there, not slide there. `LandingPage` sets the flag.
 */
const NAV_VARIABLES =
  "[--lp-nav-hero-h:4.5rem] [--lp-nav-shrink:0.5rem] sm:[--lp-nav-hero-h:5.3rem] sm:[--lp-nav-shrink:1.3rem]";
const NAV_TRANSITION =
  "group-data-[nav-live=true]/landing:[transition:--lp-nav-t_480ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
/*
 * The header blurs what is beneath it. Over the hero that is the grid, whose
 * blurred lines read as a soft haze that fades out at the top and the sides
 * (`NAV_HAZE`); once settled, a solid tint comes in (`NAV_TINT`), ahead of
 * the shrink so the devices leaving under the bar never dim its links. Both
 * layers follow the shrink, so the look changes with the size.
 */
const NAV_SURFACE = "backdrop-blur-[18px]";
const NAV_HAZE =
  "pointer-events-none absolute inset-0 -z-10 opacity-[calc(1-var(--lp-nav-t))] [background-image:linear-gradient(to_bottom,var(--color-background),transparent_1.6rem),linear-gradient(to_right,var(--color-background),transparent_3rem),linear-gradient(to_left,var(--color-background),transparent_3rem)]";
const NAV_TINT =
  "bg-background/75 pointer-events-none absolute inset-0 -z-10 opacity-[min(1,calc(var(--lp-nav-t)*3))]";
const NAV_HEIGHT =
  "h-[calc(var(--lp-nav-hero-h)_-_var(--lp-nav-shrink)_*_var(--lp-nav-t))]";
const LOGO_SIZE =
  "h-[calc(2.2rem_-_0.2rem_*_var(--lp-nav-t))] w-[calc(7.7rem_-_0.7rem_*_var(--lp-nav-t))] sm:w-[calc(10rem_-_2rem_*_var(--lp-nav-t))]";
const TOGGLE_SIZE = "size-[calc(2.75rem_-_0.25rem_*_var(--lp-nav-t))]";
const BUTTON_HEIGHT = "min-h-[calc(2.75rem_-_0.25rem_*_var(--lp-nav-t))]";

/**
 * The landing's own header; the app shell's navbar is hidden for this route
 * (see landing.css). One fixed bar for the whole page, rendered inside the
 * hero's stage so it can sit between the Bubble's two canvases: over the
 * content canvas, under the droplet. The droplet refracts a `capture` copy
 * of it that only exists inside the html-in-canvas subtree (invisible and
 * inert anywhere else), while the content canvas is clipped under the bar
 * so the copy never shows through the blur. Over the hero it has the hero
 * size; once the stage starts to leave it settles into its own
 * (`data-settled`, set by landing.css from the hero's view timeline, or by
 * `LandingPage` where scroll-driven animations are missing). Sections offset
 * their scroll targets by the settled height.
 */
export function LandingNav({
  ref,
  isAuthenticated,
  isStarting,
  onStart,
  capture = false,
}: {
  ref?: React.Ref<HTMLElement>;
  /** Signed-in visitors (at `/?landing=true`) go straight to their quizzes. */
  isAuthenticated: boolean;
  isStarting: boolean;
  onStart: () => void;
  /** The Bubble's capture-only copy. */
  capture?: boolean;
}): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  // One underline glides between the hovered (or focused) section links.
  const [underline, setUnderline] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const [isUnderlineVisible, setIsUnderlineVisible] = useState(false);
  const showUnderline = (
    event: React.SyntheticEvent<HTMLAnchorElement>,
  ): void => {
    const link = event.currentTarget;
    setUnderline({ left: link.offsetLeft + 12, width: link.offsetWidth - 24 });
    setIsUnderlineVisible(true);
  };
  const hideUnderline = (): void => {
    setIsUnderlineVisible(false);
  };

  return (
    <header
      ref={ref}
      data-landing-nav={capture ? "capture" : "fixed"}
      inert={capture}
      aria-hidden={capture}
      className={cn(
        "border-border/70 inset-x-0 top-0 z-50 grid grid-cols-[1fr_auto] items-center border-b px-4 min-[1030px]:grid-cols-[1fr_auto_1fr] sm:px-[1.4rem] lg:px-[2.2rem]",
        NAV_VARIABLES,
        NAV_TRANSITION,
        NAV_HEIGHT,
        NAV_SURFACE,
        capture
          ? "invisible absolute [canvas_&]:visible"
          : "fixed data-[settled=true]:[--lp-nav-t:1]",
      )}
    >
      <span aria-hidden="true" className={NAV_HAZE} />
      <span aria-hidden="true" className={NAV_TINT} />
      <Link
        href="/?landing=true"
        aria-label="Testownik"
        className={cn(
          "relative block justify-self-start rounded-xs",
          LOGO_SIZE,
          FOCUS_RING,
        )}
      >
        <Image
          src={wordmarkLight}
          alt="Testownik"
          className="absolute inset-0 size-full object-contain object-left dark:hidden"
        />
        <Image
          src={wordmarkDark}
          alt=""
          className="absolute inset-0 hidden size-full object-contain object-left dark:block"
        />
      </Link>

      <nav
        aria-label="Główna nawigacja"
        onPointerLeave={hideUnderline}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            hideUnderline();
          }
        }}
        className="relative hidden items-center gap-1 justify-self-center min-[1030px]:flex"
      >
        {SECTION_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={(event) => {
              const target = document.querySelector(link.href);
              if (!(target instanceof HTMLElement)) {
                return;
              }
              event.preventDefault();
              scrollToLandingSection(target);
              window.history.replaceState(null, "", link.href);
            }}
            onPointerEnter={showUnderline}
            onFocus={showUnderline}
            className={cn(
              "text-foreground/80 hover:text-foreground relative rounded-md px-3 py-2 text-[0.92rem] font-semibold tracking-[-0.01em] transition-colors duration-200",
              FOCUS_RING,
            )}
          >
            {link.label}
          </a>
        ))}
        <span
          aria-hidden="true"
          style={
            underline === null
              ? undefined
              : { left: underline.left, width: underline.width }
          }
          className={cn(
            "bg-primary pointer-events-none absolute bottom-1 h-px transition-[left,width,opacity] duration-300 ease-out motion-reduce:transition-none",
            isUnderlineVisible && underline !== null
              ? "opacity-100"
              : "opacity-0",
          )}
        />
      </nav>

      <div className="col-start-2 flex items-center justify-end gap-2 justify-self-end min-[1030px]:col-start-3 sm:gap-3">
        <button
          type="button"
          aria-label="Zmień motyw"
          onClick={() => {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
          className={cn(
            "border-border bg-card text-foreground relative grid place-items-center rounded-full border transition-[background-color,border-color] duration-300",
            "hover:border-primary/40 hover:bg-secondary",
            TOGGLE_SIZE,
            FOCUS_RING,
          )}
        >
          <Sun aria-hidden="true" className="absolute w-4 dark:hidden" />
          <Moon aria-hidden="true" className="absolute hidden w-4 dark:block" />
        </button>

        {isAuthenticated ? (
          <LandingButtonLink
            href="/quizzes"
            className={cn(START_BUTTON_CLASS, BUTTON_HEIGHT)}
          >
            Otwórz Testownik
            <ArrowUpRight aria-hidden="true" />
          </LandingButtonLink>
        ) : (
          <LandingButton
            onClick={onStart}
            disabled={isStarting}
            className={cn(
              START_BUTTON_CLASS,
              BUTTON_HEIGHT,
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isStarting ? "Uruchamiam…" : "Zacznij"}
            <ArrowUpRight aria-hidden="true" />
          </LandingButton>
        )}
      </div>
    </header>
  );
}
