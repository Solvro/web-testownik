"use client";

import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { LANDING_SECTIONS } from "../landing-sections";
import { wordmarkDark, wordmarkLight } from "../logos";
import { followLandingSectionLink } from "../scroll-to-section";
import { FOCUS_RING } from "../ui/focus";
import { LandingButton, LandingButtonLink } from "../ui/landing-button";
import { NAV_HOVER_NONE } from "./landing-nav-hover";
import type { NavHover } from "./landing-nav-hover";

/*
 * The closing section keeps its TOC entry, but the header already carries the
 * call to action, so it gets no link of its own here.
 */
const SECTION_LINKS = LANDING_SECTIONS.filter(({ id }) => id !== "footer").map(
  ({ id, navLabel }) => ({ id, href: `#${id}`, label: navLabel }),
);

const START_BUTTON_CLASS = cn(
  "px-[0.9rem] text-[0.78rem] tracking-[0.02em] normal-case sm:px-[1.15rem] sm:text-[0.86rem]",
  "transition-[gap,background-color] duration-300",
  "hover:gap-4 hover:bg-primary/90",
  "active:translate-y-0 active:shadow-none",
);

/*
 * Each dimension is its hero value minus a shrink scaled by `--lp-nav-t` (0
 * over the hero, 1 once settled). landing.css drives the property from the
 * hero's view timeline, or transitions it on `data-settled` without
 * scroll-driven animations.
 */
const NAV_VARIABLES =
  "[--lp-nav-hero-h:4.5rem] [--lp-nav-shrink:0.5rem] sm:[--lp-nav-hero-h:5.3rem] sm:[--lp-nav-shrink:1.3rem]";
/*
 * The tint comes in over the first third of the shrink, so the devices leaving
 * under the bar never dim its links.
 */
const NAV_SURFACE = "backdrop-blur-[18px]";
const NAV_HAZE =
  "pointer-events-none absolute inset-0 -z-10 opacity-[calc(1-var(--lp-nav-t))] [background-image:linear-gradient(to_bottom,var(--color-background),transparent_1.6rem),linear-gradient(to_right,var(--color-background),transparent_3rem),linear-gradient(to_left,var(--color-background),transparent_3rem)]";
const NAV_TINT =
  "bg-background/75 pointer-events-none absolute inset-0 -z-10 opacity-[min(1,calc(var(--lp-nav-t)*3))]";
const NAV_HEIGHT =
  "h-[calc(var(--lp-nav-hero-h)_-_var(--lp-nav-shrink)_*_var(--lp-nav-t))]";
// Laid out at the hero size and scaled down with the bar: a box that changes
// size re-lays out and re-rasterises the SVG every frame, which stutters.
const LOGO_SIZE =
  "h-[2.2rem] w-[8.75rem] origin-left [scale:calc(1_-_0.2_*_var(--lp-nav-t))] sm:w-[10rem]";
const TOGGLE_SIZE = "size-[calc(2.75rem_-_0.25rem_*_var(--lp-nav-t))]";
const BUTTON_HEIGHT = "min-h-[calc(2.75rem_-_0.25rem_*_var(--lp-nav-t))]";

/**
 * The landing's fixed header, taller over the hero. It renders inside the
 * stage, above the Bubble's canvases and the device layer. The droplet
 * refracts a `capture` copy that only exists inside the html-in-canvas subtree
 * and mirrors the real bar's hover state.
 */
export function LandingNav({
  ref,
  isAuthenticated,
  isStarting,
  onStart,
  capture = false,
  hover = NAV_HOVER_NONE,
  onHoverChange,
}: {
  ref?: React.Ref<HTMLElement>;
  /** Signed-in visitors (at `/?landing=true`) go straight to their quizzes. */
  isAuthenticated: boolean;
  isStarting: boolean;
  onStart: () => void;
  capture?: boolean;
  hover?: NavHover;
  /** The real bar reports changes here; the copy only reads `hover`. */
  onHoverChange?: (patch: Partial<NavHover>) => void;
}): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  // One underline glides between the hovered (or focused) section links.
  const showUnderline = (
    event: React.SyntheticEvent<HTMLAnchorElement>,
    href: string,
  ): void => {
    const link = event.currentTarget;
    onHoverChange?.({
      link: href,
      underline: { left: link.offsetLeft + 12, width: link.offsetWidth - 24 },
    });
  };
  const hideUnderline = (): void => {
    onHoverChange?.({ link: null });
  };
  const setControl = (control: NavHover["control"]): void => {
    onHoverChange?.({ control });
  };
  const { underline } = hover;

  return (
    <header
      ref={ref}
      data-landing-nav={capture ? "capture" : "fixed"}
      inert={capture}
      aria-hidden={capture}
      className={cn(
        "border-border/70 inset-x-0 top-0 z-80 grid grid-cols-[1fr_auto] items-center border-b px-4 min-[1030px]:grid-cols-[1fr_auto_1fr] sm:px-[1.4rem] lg:px-[2.2rem]",
        NAV_VARIABLES,
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
              followLandingSectionLink(event, link.id);
            }}
            onPointerEnter={(event) => {
              showUnderline(event, link.href);
            }}
            onFocus={(event) => {
              showUnderline(event, link.href);
            }}
            className={cn(
              "text-foreground/80 relative rounded-md px-3 py-2 text-[0.92rem] font-semibold tracking-[-0.01em] transition-colors duration-200",
              hover.link === link.href && "text-foreground",
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
            hover.link !== null && underline !== null
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
          onPointerEnter={() => {
            setControl("toggle");
          }}
          onPointerLeave={() => {
            setControl(null);
          }}
          className={cn(
            "border-border bg-card text-foreground relative grid place-items-center rounded-full border transition-[background-color,border-color] duration-300",
            hover.control === "toggle" && "border-primary/40 bg-secondary",
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
            onPointerEnter={() => {
              setControl("start");
            }}
            onPointerLeave={() => {
              setControl(null);
            }}
            className={cn(
              START_BUTTON_CLASS,
              BUTTON_HEIGHT,
              hover.control === "start" && "bg-primary/90 gap-4",
            )}
          >
            Otwórz Testownik
            <ArrowUpRight aria-hidden="true" />
          </LandingButtonLink>
        ) : (
          <LandingButton
            onClick={onStart}
            disabled={isStarting}
            onPointerEnter={() => {
              setControl("start");
            }}
            onPointerLeave={() => {
              setControl(null);
            }}
            className={cn(
              START_BUTTON_CLASS,
              BUTTON_HEIGHT,
              hover.control === "start" && "bg-primary/90 gap-4",
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
