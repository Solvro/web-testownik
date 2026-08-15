"use client";

import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { LandingButton } from "../components/landing-button";
import { wordmarkDark, wordmarkLight } from "../logos";

const SECTION_LINKS = [
  { href: "#features", label: "Produkt" },
  { href: "#story", label: "Historia" },
  { href: "#team", label: "Zespół" },
  { href: "/login?redirect=%2Fquizzes", label: "Zaloguj" },
];

/**
 * The landing's own header. It floats over the hero rather than participating in
 * the app shell, whose navbar is hidden for this route (see landing.css).
 */
export function LandingNav({
  isStarting,
  onStart,
}: {
  isStarting: boolean;
  onStart: () => void;
}): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="border-border/70 absolute top-0 left-0 z-50 grid h-[4.5rem] w-full grid-cols-[1fr_auto_1fr] items-center border-b px-4 backdrop-blur-[18px] sm:h-[5.3rem] sm:px-[1.4rem] lg:px-[2.2rem]">
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
        className="hidden items-center gap-1 justify-self-center lg:flex"
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

      <div className="flex items-center justify-end gap-2 justify-self-end sm:gap-3">
        <button
          type="button"
          aria-label="Zmień motyw"
          onClick={() => {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
          className={cn(
            "border-border bg-card text-foreground relative grid size-[2.45rem] place-items-center rounded-full border transition-[background-color,border-color] duration-200",
            "hover:border-primary/40 hover:bg-secondary",
            "sm:size-[2.65rem]",
            FOCUS_RING,
          )}
        >
          <Sun aria-hidden="true" className="absolute w-4 dark:hidden" />
          <Moon aria-hidden="true" className="absolute hidden w-4 dark:block" />
        </button>

        <LandingButton
          onClick={onStart}
          className={cn(
            "min-h-[2.45rem] px-[0.9rem] text-[0.78rem] tracking-[0.02em] normal-case sm:min-h-11 sm:px-[1.15rem] sm:text-[0.86rem]",
            "transition-[gap,background-color] duration-200",
            "hover:gap-4",
            "active:translate-y-0 active:shadow-none",
          )}
        >
          {isStarting ? "Uruchamiam…" : "Zacznij"}
          <ArrowUpRight aria-hidden="true" />
        </LandingButton>
      </div>
    </header>
  );
}
