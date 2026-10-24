"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { LANDING_SECTIONS } from "../landing-sections";
import { wordmarkDark, wordmarkLight } from "../logos";
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
  "min-h-11 px-[0.9rem] text-[0.78rem] tracking-[0.02em] normal-case sm:min-h-11 sm:px-[1.15rem] sm:text-[0.86rem]",
  "transition-[gap,background-color] duration-200",
  "hover:gap-4",
  "active:translate-y-0 active:shadow-none",
);

/**
 * The landing's own header. It floats over the hero rather than participating in
 * the app shell, whose navbar is hidden for this route (see landing.css).
 */
export function LandingNav({
  isAuthenticated,
  isStarting,
  onStart,
}: {
  /** Signed-in visitors (at `/?landing=true`) go straight to their quizzes. */
  isAuthenticated: boolean;
  isStarting: boolean;
  onStart: () => void;
}): React.JSX.Element {
  return (
    <header className="border-border/70 absolute top-0 left-0 z-50 grid h-[4.5rem] w-full grid-cols-[1fr_auto] items-center border-b px-4 backdrop-blur-[18px] min-[1030px]:grid-cols-[1fr_auto_1fr] sm:h-[5.3rem] sm:px-[1.4rem] lg:px-[2.2rem]">
      <Link
        href="/?landing=true"
        aria-label="Testownik"
        className={cn(
          "relative block h-[2.2rem] w-[7.7rem] justify-self-start rounded-xs sm:w-40",
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
        {isAuthenticated ? (
          <LandingButtonLink href="/quizzes" className={START_BUTTON_CLASS}>
            Otwórz Testownik
            <ArrowUpRight aria-hidden="true" />
          </LandingButtonLink>
        ) : (
          <LandingButton
            onClick={onStart}
            disabled={isStarting}
            className={cn(
              START_BUTTON_CLASS,
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
