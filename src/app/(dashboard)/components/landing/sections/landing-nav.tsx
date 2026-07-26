"use client";

import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

import { FOCUS_RING } from "../components/focus";
import { LandingButton } from "../components/landing-button";
import { wordmarkDark, wordmarkLight } from "../logos";

const SECTION_LINKS = [
  { href: "#product", label: "Produkt" },
  { href: "#story", label: "Historia" },
  { href: "#team", label: "Zespół" },
];

const NAV_LINK_CLASS = `text-foreground hover:text-primary rounded-xs text-[0.72rem] font-[680] tracking-[0.08em] uppercase ${FOCUS_RING}`;

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
    <header className="border-border/70 bg-background/80 absolute top-0 left-0 z-50 flex h-[4.5rem] w-full items-center justify-between border-b px-4 backdrop-blur-[18px] sm:h-[5.3rem] sm:px-[1.4rem] lg:px-[2.2rem]">
      <Link
        href="/?landing=true"
        aria-label="Testownik"
        className={`relative block h-[2.2rem] w-[7.7rem] rounded-xs sm:w-40 ${FOCUS_RING}`}
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
        className="flex items-center gap-[0.45rem] sm:gap-[1.45rem]"
      >
        {SECTION_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`${NAV_LINK_CLASS} hidden lg:block`}
          >
            {link.label}
          </a>
        ))}
        <Link
          href="/login?redirect=%2Fquizzes"
          className={`${NAV_LINK_CLASS} hidden sm:block`}
        >
          Zaloguj
        </Link>

        <button
          type="button"
          aria-label="Zmień motyw"
          onClick={() => {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
          className={`border-border bg-card text-foreground relative grid size-[2.45rem] place-items-center rounded-full border sm:size-[2.65rem] ${FOCUS_RING}`}
        >
          <Sun aria-hidden="true" className="absolute w-4 dark:hidden" />
          <Moon aria-hidden="true" className="absolute hidden w-4 dark:block" />
        </button>

        <LandingButton
          onClick={onStart}
          className="min-h-[2.45rem] px-[0.78rem] text-[0.62rem] sm:min-h-11 sm:px-[1.1rem] sm:text-xs"
        >
          {isStarting ? "Uruchamiam…" : "Zacznij"}
          <ArrowUpRight aria-hidden="true" />
        </LandingButton>
      </nav>
    </header>
  );
}
