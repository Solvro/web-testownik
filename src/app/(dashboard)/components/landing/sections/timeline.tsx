"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { LandingSection } from "../components/section";
import { DisplayHeading } from "../components/typography";
import { SOLVRO_PORTFOLIO_URL, STORY } from "../landing-content";

/**
 * Straight vertical rail with L-shaped stubs into each event.
 *
 * Fill progress updates the DOM directly (no React re-render per scroll frame).
 * Events reveal once via IntersectionObserver.
 */
export function Timeline(): React.JSX.Element {
  const trackReference = useRef<HTMLDivElement>(null);
  const fillReference = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(() => STORY.map(() => false));

  useEffect(() => {
    const track = trackReference.current;
    const fill = fillReference.current;
    if (track === null || fill === null) {
      return;
    }

    let frame = 0;

    const paintFill = (): void => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const head = window.innerHeight * 0.38;
      const progress = Math.min(
        1,
        Math.max(0, (head - rect.top) / Math.max(rect.height, 1)),
      );
      fill.style.transform = `scaleY(${progress.toString()})`;
    };

    const schedulePaint = (): void => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(paintFill);
      }
    };

    paintFill();
    window.addEventListener("scroll", schedulePaint, { passive: true });
    window.addEventListener("resize", schedulePaint);

    const items = [
      ...track.querySelectorAll<HTMLElement>("[data-timeline-event]"),
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        setRevealed((current) => {
          let changed = false;
          const next = [...current];
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }
            const index = Number(
              (entry.target as HTMLElement).dataset.timelineEvent,
            );
            if (!Number.isFinite(index) || next[index]) {
              continue;
            }
            next[index] = true;
            changed = true;
            observer.unobserve(entry.target);
          }
          return changed ? next : current;
        });
      },
      { rootMargin: "-20% 0px -35% 0px", threshold: 0 },
    );

    for (const item of items) {
      observer.observe(item);
    }

    return () => {
      window.removeEventListener("scroll", schedulePaint);
      window.removeEventListener("resize", schedulePaint);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <LandingSection
      id="story"
      className="grid scroll-mt-4 grid-cols-1 gap-12 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-[7vw]"
    >
      <header className="self-start lg:sticky lg:top-32">
        <DisplayHeading>
          Najpierw egzamin.
          <br />
          <em>Potem produkt.</em>
        </DisplayHeading>
        <p className="text-muted-foreground max-w-[32rem] leading-[1.55]">
          Zweryfikowana historia projektu na podstawie oficjalnego portfolio KN
          Solvro.
        </p>
      </header>

      <div ref={trackReference} className="relative">
        <div
          aria-hidden="true"
          className="bg-border absolute top-0 bottom-0 left-0 w-px"
        />
        <div
          ref={fillReference}
          aria-hidden="true"
          className="bg-primary absolute top-0 left-0 h-full w-px origin-top will-change-transform"
          style={{
            transform: "scaleY(0)",
            boxShadow:
              "0 0 10px color-mix(in oklch, var(--primary) 65%, transparent), 0 0 20px color-mix(in oklch, var(--primary) 30%, transparent)",
          }}
        />

        <ol className="flex flex-col gap-16 sm:gap-20">
          {STORY.map((event, index) => {
            const isVisible = revealed[index] ?? false;
            return (
              <li
                key={event.date}
                data-timeline-event={String(index)}
                className={cn(
                  "relative pl-10 sm:pl-12",
                  "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  isVisible
                    ? "translate-x-0 opacity-100"
                    : "translate-x-3 opacity-0",
                )}
              >
                {/* L-branch: |__ */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-3 left-0 h-px w-8 origin-left transition-colors duration-300 sm:w-10",
                    isVisible ? "bg-primary" : "bg-border",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[0.6rem] left-8 size-2 rounded-full transition-[background-color,box-shadow] duration-300 sm:left-10",
                    isVisible
                      ? "bg-primary shadow-[0_0_10px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                      : "bg-border",
                  )}
                />

                <time className="text-primary text-[0.72rem] font-bold tracking-[0.12em] uppercase">
                  {event.date}
                </time>
                <h3 className="mt-2 text-[clamp(1.35rem,2vw,2rem)] leading-[1.15] tracking-[-0.03em]">
                  {event.title}
                </h3>
                <p className="text-muted-foreground mt-3 max-w-[36rem] leading-[1.55]">
                  {event.text}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      <a
        href={SOLVRO_PORTFOLIO_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "text-primary col-start-1 inline-flex w-fit items-center gap-[0.6rem] rounded-xs text-[0.78rem] font-bold lg:col-start-2 [&_svg]:size-4",
          FOCUS_RING,
        )}
      >
        Pełna historia w portfolio Solvro
        <ArrowUpRight aria-hidden="true" />
      </a>
    </LandingSection>
  );
}
