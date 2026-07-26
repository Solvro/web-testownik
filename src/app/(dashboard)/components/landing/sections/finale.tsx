import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { LandingButton, LandingButtonLink } from "../components/landing-button";
import { ParticleLogo } from "../components/particle-logo";
import { Eyebrow } from "../components/typography";
import { monoLabelVariants } from "../components/typography-variants";

/** Faint graph paper that fades out towards the edges. */
const gridBackdropStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(oklch(1 0 0 / 7%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 7%) 1px, transparent 1px)",
  backgroundSize: "5rem 5rem",
  maskImage: "radial-gradient(circle at 50% 54%, black, transparent 75%)",
};

export function Finale({
  isStarting,
  onStart,
}: {
  isStarting: boolean;
  onStart: () => void;
}): React.JSX.Element {
  return (
    // The closing section is the dark surface in both themes, so it opts into
    // the dark token set rather than hard-coding colours.
    <section
      id="finale"
      className="dark bg-background text-foreground relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-8 pt-28 pb-8 text-center"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={gridBackdropStyle}
      />
      <ParticleLogo className="absolute inset-0" />

      <Eyebrow className="relative">TWOJA NASTĘPNA SESJA</Eyebrow>

      {/*
       * The wordmark is the particle simulation itself — icon and lettering are
       * one object, with nothing conventional layered underneath. The canvas is
       * decorative, so the accessible name lives on the container.
       */}
      <div
        role="img"
        aria-label="Testownik"
        className="pointer-events-none relative mt-16 aspect-[2.2] w-[94vw] sm:mt-[clamp(2rem,6vh,4.5rem)] sm:aspect-[3.4] sm:w-[min(92vw,82rem)]"
      />

      <p className="text-muted-foreground relative mt-14 max-w-[44rem] text-[clamp(1rem,1.7vw,1.3rem)] leading-[1.55] sm:mt-[clamp(3rem,7vh,5rem)]">
        Wejdź do aplikacji i poznaj nowy sposób na naukę
        <br />
        Zawsze pod ręką dla ciebie i znajomych
      </p>

      <div className="relative mt-8 flex w-full flex-col gap-[0.8rem] sm:w-auto sm:flex-row">
        <LandingButtonLink
          href="/login?redirect=%2Fquizzes"
          size="large"
          className="w-full sm:w-auto"
        >
          Zaloguj się
          <ArrowUpRight aria-hidden="true" />
        </LandingButtonLink>
        <LandingButton
          size="large"
          variant="onDark"
          onClick={onStart}
          disabled={isStarting}
          className="w-full sm:w-auto"
        >
          {isStarting ? "Uruchamiam Testownik…" : "Zacznij jako gość"}
          <ArrowRight aria-hidden="true" />
        </LandingButton>
      </div>

      <footer
        className={cn(
          monoLabelVariants({ size: "xs" }),
          "relative mt-16 flex flex-col justify-between gap-4 sm:absolute sm:inset-x-8 sm:bottom-6 sm:mt-0 sm:flex-row",
        )}
      >
        <span>TESTOWNIK © {new Date().getFullYear()}</span>
        <span>
          MADE BY{" "}
          <a href="https://github.com/Antoni-Czaplicki">Antoni Czaplicki</a> ·
          KN SOLVRO
        </span>
        <Link href="/privacy-policy">PRYWATNOŚĆ</Link>
      </footer>
    </section>
  );
}
