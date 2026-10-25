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
 * The hero header blurs the grid beneath it; inside the Bubble's canvas the
 * blur softens into a haze at the top and the sides, which `HERO_HAZE`
 * stands in for until the capture is live (it hides inside the canvas).
 * `--lp-nav-hero-h` is the hero header's height, which the compact bar's
 * entrance in landing.css keys off.
 */
const HERO_CLASS =
  "absolute top-0 left-0 h-[4.5rem] w-full backdrop-blur-[18px] sm:h-[5.3rem]";
const HERO_HAZE =
  "pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_bottom,var(--color-background),transparent_1.6rem),linear-gradient(to_right,var(--color-background),transparent_3rem),linear-gradient(to_left,var(--color-background),transparent_3rem)] [canvas_&]:hidden";
/*
 * The compact bar waits above the viewport and slides in once the hero
 * header has left: landing.css drives `translate` from the hero's view
 * timeline; `data-shown` is the scroll-handler fallback.
 */
const COMPACT_CLASS =
  "bg-background/75 fixed inset-x-0 top-0 h-16 -translate-y-full backdrop-blur-[18px] transition-[translate] duration-300 ease-out data-[shown=true]:translate-y-0 motion-reduce:transition-none [--lp-nav-hero-h:4.5rem] sm:[--lp-nav-hero-h:5.3rem]";

/**
 * The landing's own header; the app shell's navbar is hidden for this route
 * (see landing.css). It renders twice. The `hero` variant sits at the top of
 * the hero, inside the Bubble's captured subtree so the droplet refracts it,
 * stays put through the hero's sticky travel and then scrolls out with the
 * stage like the rest of the hero. Once it has left, the `compact` variant
 * slides in from above and stays fixed. Nothing is swapped or hidden on the
 * way, so no scroll speed can catch the page without a header. Sections
 * offset their scroll targets by the compact height. The compact bar is
 * inert while it waits above the viewport.
 */
export function LandingNav({
  ref,
  isAuthenticated,
  isStarting,
  onStart,
  variant = "hero",
}: {
  ref?: React.Ref<HTMLElement>;
  /** Signed-in visitors (at `/?landing=true`) go straight to their quizzes. */
  isAuthenticated: boolean;
  isStarting: boolean;
  onStart: () => void;
  variant?: "hero" | "compact";
}): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const compact = variant === "compact";
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
      data-landing-nav={variant}
      // The compact bar starts inert; `LandingPage` flips it as it slides in.
      inert={compact}
      aria-hidden={compact}
      className={cn(
        "border-border/70 z-50 grid grid-cols-[1fr_auto] items-center border-b px-4 min-[1030px]:grid-cols-[1fr_auto_1fr] sm:px-[1.4rem] lg:px-[2.2rem]",
        compact ? COMPACT_CLASS : HERO_CLASS,
      )}
    >
      {compact ? null : <span aria-hidden="true" className={HERO_HAZE} />}
      <Link
        href="/?landing=true"
        aria-label="Testownik"
        className={cn(
          "relative block justify-self-start rounded-xs",
          compact ? "h-8 w-28 sm:w-32" : "h-[2.2rem] w-[7.7rem] sm:w-40",
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
            compact ? "size-10" : "size-11",
            FOCUS_RING,
          )}
        >
          <Sun aria-hidden="true" className="absolute w-4 dark:hidden" />
          <Moon aria-hidden="true" className="absolute hidden w-4 dark:block" />
        </button>

        {isAuthenticated ? (
          <LandingButtonLink
            href="/quizzes"
            className={cn(
              START_BUTTON_CLASS,
              compact ? "min-h-10" : "min-h-11",
            )}
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
              compact ? "min-h-10" : "min-h-11",
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
