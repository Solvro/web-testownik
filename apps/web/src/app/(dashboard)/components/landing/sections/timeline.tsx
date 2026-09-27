"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { LandingSection } from "../components/section";
import { DisplayHeading } from "../components/typography";
import { SOLVRO_PORTFOLIO_URL, STORY } from "../landing-content";

const MARKER_OFFSET = 12;
const REVEAL_TAIL = 16;
const TYPE_START = 420;
const TYPE_STEP = 28;
const segmenter = new Intl.Segmenter("pl", { granularity: "grapheme" });

function TypedTitle({
  title,
  visible,
}: {
  title: string;
  visible: boolean;
}): React.JSX.Element {
  const textReference = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const text = textReference.current;
    if (text === null) {
      return;
    }

    text.textContent = "";
    if (!visible) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) {
      text.textContent = title;
      return;
    }

    const characters = [...segmenter.segment(title)].map(
      ({ segment }) => segment,
    );
    let index = 0;
    let interval = 0;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        text.textContent += characters[index];
        index += 1;
        if (index === characters.length) {
          window.clearInterval(interval);
        }
      }, TYPE_STEP);
    }, TYPE_START);
    const finish = (): void => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      text.textContent = title;
    };
    reduceMotion.addEventListener("change", finish);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      reduceMotion.removeEventListener("change", finish);
    };
  }, [title, visible]);

  return (
    <h3
      aria-label={title}
      className="relative mt-4 text-[clamp(1.45rem,2.15vw,2.1rem)] leading-[1.23] tracking-[-0.035em]"
    >
      <span aria-hidden="true" className="invisible">
        {title}
      </span>
      <span
        ref={textReference}
        aria-hidden="true"
        className="absolute inset-0"
      />
    </h3>
  );
}

/** The rail and event reveal share the same scroll playhead and marker positions. */
export function Timeline(): React.JSX.Element {
  const trackReference = useRef<HTMLDivElement>(null);
  const railReference = useRef<HTMLDivElement>(null);
  const fillReference = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(() => STORY.map(() => false));
  const [continuationVisible, setContinuationVisible] = useState(false);

  useEffect(() => {
    const track = trackReference.current;
    const rail = railReference.current;
    const fill = fillReference.current;
    if (track === null || rail === null || fill === null) {
      return;
    }

    let frame = 0;
    const items = [
      ...track.querySelectorAll<HTMLElement>("[data-timeline-event]"),
    ];
    const continuation = track.querySelector<HTMLElement>(
      "[data-timeline-continuation]",
    );
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paintFill = (): void => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const length = Math.max(track.scrollHeight - MARKER_OFFSET, 1);
      const head = window.innerHeight * 0.58;
      const distance = Math.min(
        length,
        Math.max(0, head - rect.top - MARKER_OFFSET),
      );
      const deepestRevealed = items.findLastIndex(
        (item) =>
          item.dataset.timelineRevealed === "true" ||
          reduceMotion.matches ||
          distance >= item.offsetTop + item.offsetHeight + REVEAL_TAIL,
      );
      const continuationReached =
        continuation !== null &&
        (continuation.dataset.timelineRevealed === "true" ||
          reduceMotion.matches ||
          distance >= continuation.offsetTop);

      const revealedDistance =
        continuation !== null && continuationReached
          ? continuation.offsetTop + continuation.offsetHeight - MARKER_OFFSET
          : deepestRevealed === -1
            ? 0
            : items[deepestRevealed].offsetTop +
              items[deepestRevealed].offsetHeight +
              REVEAL_TAIL;
      const progress = Math.min(
        1,
        Math.max(distance, revealedDistance) / length,
      );
      rail.style.height = `${length.toString()}px`;
      fill.style.height = `${length.toString()}px`;
      fill.style.transform = `scaleY(${progress.toString()})`;

      setRevealed((current) => {
        const next = current.map((visible, index) => {
          return visible || index <= deepestRevealed;
        });
        return next.some((visible, index) => visible !== current[index])
          ? next
          : current;
      });
      if (continuation !== null) {
        setContinuationVisible((visible) => visible || continuationReached);
      }
    };

    const schedulePaint = (): void => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(paintFill);
      }
    };

    schedulePaint();
    window.addEventListener("scroll", schedulePaint, { passive: true });
    window.addEventListener("resize", schedulePaint);
    reduceMotion.addEventListener("change", schedulePaint);
    const resizeObserver = new ResizeObserver(schedulePaint);
    resizeObserver.observe(track);

    return () => {
      window.removeEventListener("scroll", schedulePaint);
      window.removeEventListener("resize", schedulePaint);
      reduceMotion.removeEventListener("change", schedulePaint);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
    };
  }, [revealed, continuationVisible]);

  return (
    <LandingSection
      id="story"
      showPlaceholder={false}
      className="mb-12 grid scroll-mt-4 grid-cols-1 gap-14 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-[7vw]"
    >
      <header className="self-start lg:sticky lg:top-20">
        <DisplayHeading className="lg:text-[clamp(3.5rem,5.1vw,6rem)]">
          Najpierw egzamin.
          <br />
          <em>Potem produkt.</em>
        </DisplayHeading>
        <p className="text-muted-foreground mt-6 max-w-lg leading-[1.65] sm:mt-5">
          Zweryfikowana historia projektu na podstawie oficjalnego portfolio KN
          Solvro.
        </p>
        <Link
          href={SOLVRO_PORTFOLIO_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "text-primary inline-flex w-fit items-center gap-2 text-[0.8rem] font-bold transition-[gap,color] duration-300 hover:gap-3 [&_svg]:size-4",
            FOCUS_RING,
          )}
        >
          Pełna historia w portfolio Solvro
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </header>

      <div ref={trackReference} className="relative ml-2 pb-12 sm:ml-4 lg:ml-0">
        <div
          ref={railReference}
          aria-hidden="true"
          className="absolute top-3 left-0 w-px"
          style={{
            maskImage: "linear-gradient(to bottom, black 100%, transparent)",
          }}
        />
        <div
          ref={fillReference}
          aria-hidden="true"
          className="from-primary via-primary to-primary/0 absolute top-3 left-0 w-px origin-top bg-linear-to-b from-0% via-85% to-110% will-change-transform motion-reduce:will-change-auto"
          style={{
            transform: "scaleY(0)",
            boxShadow:
              "0 0 10px color-mix(in oklch, var(--primary) 15%, transparent), 0 0 10px color-mix(in oklch, var(--primary) 10%, transparent)",
          }}
        />

        <ol className="flex flex-col gap-20 pt-12 sm:gap-24">
          {STORY.map((event, index) => {
            const isVisible = revealed[index] ?? false;
            return (
              <li
                key={event.date}
                data-timeline-event={String(index)}
                data-timeline-revealed={isVisible}
                className="relative pl-12 sm:pl-14"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-3 left-0 h-px w-8 origin-left transition-[background-color,transform] duration-500 sm:w-10",
                    isVisible
                      ? "bg-primary scale-x-100"
                      : "bg-border scale-x-0 motion-reduce:scale-x-100",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 left-8 size-2 rounded-full transition-[background-color,box-shadow,transform] duration-500 sm:left-10",
                    isVisible
                      ? "bg-primary scale-125 opacity-100 shadow-[0_0_0_5px_color-mix(in_oklch,var(--primary)_8%,transparent),0_0_18px_color-mix(in_oklch,var(--primary)_30%,transparent)]"
                      : "bg-border scale-75 opacity-0 motion-reduce:scale-100",
                  )}
                />

                <time
                  className={cn(
                    "text-primary mt-1 block text-xs font-bold tracking-[0.12em] capitalize motion-reduce:opacity-100",
                    isVisible ? "lp-story-date" : "opacity-0",
                  )}
                >
                  {event.date}
                </time>
                <TypedTitle title={event.title} visible={isVisible} />
                <p
                  className={cn(
                    "text-muted-foreground mt-2 max-w-xl leading-[1.7] motion-reduce:opacity-100",
                    isVisible ? "lp-story-description" : "opacity-0",
                  )}
                  style={{
                    animationDelay: `${(TYPE_START + [...segmenter.segment(event.title)].length * TYPE_STEP + 220).toString()}ms`,
                  }}
                >
                  {event.text}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </LandingSection>
  );
}
