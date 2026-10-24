"use client";

import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

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
  "transition-[gap,background-color] duration-200",
  "hover:gap-4",
  "active:translate-y-0 active:shadow-none",
);

/**
 * The landing's own header; the app shell's navbar is hidden for this route
 * (see landing.css). It renders twice: the `hero` variant sits at the top of
 * the hero, inside the Bubble's captured subtree so the droplet refracts it,
 * and stays put through the hero's sticky travel. Once it has scrolled out
 * of view the shorter `compact` variant slides in, fixed over the rest of the
 * page; sections offset their scroll targets by its height. Whichever is
 * hidden is inert.
 */
export function LandingNav({
  isAuthenticated,
  isStarting,
  onStart,
  variant = "hero",
  hidden = false,
}: {
  /** Signed-in visitors (at `/?landing=true`) go straight to their quizzes. */
  isAuthenticated: boolean;
  isStarting: boolean;
  onStart: () => void;
  variant?: "hero" | "compact";
  /** Compact only: slid away above the viewport. */
  hidden?: boolean;
}): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const compact = variant === "compact";

  return (
    <header
      inert={hidden}
      aria-hidden={hidden}
      className={cn(
        "border-border/70 z-50 grid grid-cols-[1fr_auto] items-center border-b px-4 backdrop-blur-[18px] min-[1030px]:grid-cols-[1fr_auto_1fr] sm:px-[1.4rem] lg:px-[2.2rem]",
        compact
          ? cn(
              "bg-background/75 fixed inset-x-0 top-0 h-14 transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none",
              hidden && "-translate-y-full opacity-0",
            )
          : "absolute top-0 left-0 h-[4.5rem] w-full sm:h-[5.3rem]",
      )}
    >
      <Link
        href="/?landing=true"
        aria-label="Testownik"
        className={cn(
          "relative block justify-self-start rounded-xs",
          compact
            ? "h-[1.8rem] w-[6.4rem] sm:w-[7.4rem]"
            : "h-[2.2rem] w-[7.7rem] sm:w-40",
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
        className="hidden items-center gap-1 justify-self-center min-[1030px]:flex"
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
            className={cn(
              "text-foreground/80 hover:text-foreground relative rounded-md px-3 py-2 text-[0.92rem] font-semibold tracking-[-0.01em] transition-[color,transform] duration-200",
              "hover:-translate-y-px active:translate-y-0",
              "after:bg-primary after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:transition-transform after:duration-200 hover:after:scale-x-100",
              FOCUS_RING,
            )}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="col-start-2 flex items-center justify-end gap-2 justify-self-end min-[1030px]:col-start-3 sm:gap-3">
        <button
          type="button"
          aria-label="Zmień motyw"
          onClick={() => {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
          className={cn(
            "border-border bg-card text-foreground relative grid place-items-center rounded-full border transition-[background-color,border-color] duration-200",
            "hover:border-primary/40 hover:bg-secondary",
            compact ? "size-9" : "size-11",
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
              compact ? "min-h-9 sm:min-h-9" : "min-h-11 sm:min-h-11",
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
              compact ? "min-h-9 sm:min-h-9" : "min-h-11 sm:min-h-11",
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
