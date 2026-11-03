"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { LandingBlogPost } from "../../lib/blog";
import { STORY, STORY_HEADING } from "../landing-content";
import type { TimelineEntry } from "../landing-content";
import { FOCUS_RING } from "../ui/focus";
import { HandNote } from "../ui/hand-note";
import { LandingSection } from "../ui/section";
import { DisplayHeading } from "../ui/typography";
import { UpdateNote } from "./update-note";

/** Where the playhead sits, as a fraction of the viewport height. */
const REVEAL_HEAD = 0.7;
const TYPE_START = 260;
const TYPE_STEP = 28;
/** Long titles type faster, so the description never waits more than this. */
const TYPE_BUDGET = 700;
const INK_WIDTH = 12;
/** The stroke starts level with the first marker, at the track's `top-3`. */
const INK_TOP = 12;
const segmenter = new Intl.Segmenter("pl", { granularity: "grapheme" });

function StoryText({
  text,
  link,
}: Pick<TimelineEntry, "text" | "link">): React.ReactNode {
  const at = link === undefined ? -1 : text.indexOf(link.label);
  if (link === undefined || at === -1) {
    return text;
  }
  return (
    <>
      {text.slice(0, at)}
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "text-foreground decoration-primary/40 hover:text-primary rounded-sm underline underline-offset-3 transition-colors hover:decoration-current",
          FOCUS_RING,
        )}
      >
        {link.label}
      </a>
      {text.slice(at + link.label.length)}
    </>
  );
}

function typeStep(length: number): number {
  return Math.min(TYPE_STEP, TYPE_BUDGET / Math.max(length, 1));
}

/** Cheap deterministic noise, so the stroke keeps its shape across resizes. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state += 1;
    const value = Math.sin(state * 12.9898) * 43_758.5453;
    return value - Math.floor(value);
  };
}

/** A vertical stroke that wanders a pixel or two, so it reads as hand-drawn. */
function inkPath(length: number, seed: number): string {
  const random = seeded(seed);
  const centre = INK_WIDTH / 2;
  const points: [number, number][] = [[centre, 0]];
  let y = 0;
  let drift = 0;
  while (y < length) {
    y = Math.min(length, y + 36 + random() * 44);
    drift = Math.max(-2.2, Math.min(2.2, drift * 0.4 + (random() - 0.5) * 3));
    points.push([centre + drift, y]);
  }
  let d = `M${centre.toString()} 0`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, py] = points[index];
    const [nx, ny] = points[index + 1];
    d += ` Q${x.toFixed(2)} ${py.toFixed(1)} ${((x + nx) / 2).toFixed(2)} ${((py + ny) / 2).toFixed(1)}`;
  }
  const [lx, ly] = points.at(-1) ?? [centre, length];
  d += ` L${lx.toFixed(2)} ${ly.toFixed(1)}`;
  return d;
}

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
    const step = typeStep(characters.length);
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        text.textContent += characters[index];
        index += 1;
        if (index === characters.length) {
          window.clearInterval(interval);
        }
      }, step);
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
        data-timeline-title={title}
        className="absolute inset-0"
      />
    </h3>
  );
}

/**
 * The rail draws itself down to a playhead below the middle of the viewport,
 * revealing events as it reaches them. It never retreats above a revealed one.
 */
export function Timeline({
  blogPosts,
}: {
  blogPosts: Promise<LandingBlogPost[]>;
}): React.JSX.Element {
  const trackReference = useRef<HTMLDivElement>(null);
  const inkReference = useRef<SVGSVGElement>(null);
  const [revealed, setRevealed] = useState(() => STORY.map(() => false));
  const [inkLength, setInkLength] = useState(0);

  useEffect(() => {
    const track = trackReference.current;
    const ink = inkReference.current;
    if (track === null || ink === null) {
      return;
    }

    let frame = 0;
    const items = [
      ...track.querySelectorAll<HTMLElement>("[data-timeline-event]"),
    ];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paint = (): void => {
      frame = 0;
      const length = Math.max(track.clientHeight - INK_TOP, 1);
      setInkLength((current) =>
        Math.abs(current - length) < 1 ? current : length,
      );

      const head = window.innerHeight * REVEAL_HEAD;
      const distance = reduceMotion.matches
        ? length
        : Math.min(
            length,
            Math.max(0, head - track.getBoundingClientRect().top - INK_TOP),
          );
      const deepestRevealed = items.findLastIndex(
        (item) =>
          item.dataset.timelineRevealed === "true" ||
          distance >= item.offsetTop,
      );
      const floor =
        deepestRevealed === -1 ? 0 : items[deepestRevealed].offsetTop;
      const progress = Math.min(1, Math.max(distance, floor) / length);
      ink.style.strokeDashoffset = (1 - progress).toString();

      setRevealed((current) => {
        const next = current.map(
          (visible, index) => visible || index <= deepestRevealed,
        );
        return next.some((visible, index) => visible !== current[index])
          ? next
          : current;
      });
    };

    const schedulePaint = (): void => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    // The timeline is several screens below the hero. Do not measure its
    // items on every hero frame; catch up before it enters the viewport.
    let isNearViewport = false;
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isNearViewport = entry.isIntersecting;
        if (isNearViewport) {
          schedulePaint();
        }
      },
      { rootMargin: "100px" },
    );
    visibilityObserver.observe(track);
    const onScroll = (): void => {
      if (isNearViewport) {
        schedulePaint();
      }
    };

    schedulePaint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedulePaint);
    reduceMotion.addEventListener("change", schedulePaint);
    const resizeObserver = new ResizeObserver(schedulePaint);
    resizeObserver.observe(track);

    return () => {
      window.removeEventListener("scroll", onScroll);
      visibilityObserver.disconnect();
      window.removeEventListener("resize", schedulePaint);
      reduceMotion.removeEventListener("change", schedulePaint);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
    };
  }, []);

  const path = inkLength > 0 ? inkPath(inkLength, 7) : "";

  return (
    <LandingSection
      id="story"
      className="mb-12 grid scroll-mt-[5rem] grid-cols-1 gap-14 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-[7vw]"
    >
      {/*
       * Below `lg` the header dissolves into the grid so the note can follow
       * the timeline instead of pushing it a screen down.
       */}
      <header className="min-w-0 self-start max-lg:contents lg:sticky lg:top-24">
        <div>
          <HandNote className="mb-5">
            03 / zaczęło się tak jak u Ciebie
          </HandNote>
          <DisplayHeading className="lg:text-[clamp(3.5rem,5.1vw,6rem)]">
            {STORY_HEADING}
          </DisplayHeading>
        </div>
        <div className="max-lg:order-last max-lg:-mt-8">
          <UpdateNote posts={blogPosts} />
        </div>
      </header>

      <div ref={trackReference} className="relative ml-2 pb-12 sm:ml-4 lg:ml-0">
        <svg
          ref={inkReference}
          aria-hidden="true"
          data-timeline-ink=""
          width={INK_WIDTH}
          height={inkLength}
          viewBox={`0 0 ${INK_WIDTH.toString()} ${inkLength.toString()}`}
          className="text-primary absolute top-3 -left-1.5 overflow-visible [stroke-dasharray:1_1] [stroke-dashoffset:1]"
          style={{
            maskImage:
              "linear-gradient(to bottom, black calc(100% - 6rem), transparent)",
          }}
        >
          <path
            d={path}
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          {/* A second, thinner pass a hair to the side: uneven pen pressure. */}
          <path
            d={path}
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.9}
            strokeLinecap="round"
            opacity={0.45}
            transform="translate(0.9 1.5)"
          />
        </svg>

        <ol className="flex flex-col gap-20 pt-12 sm:gap-24">
          {STORY.map((event, index) => {
            const isVisible = revealed[index] ?? false;
            const titleLength = [...segmenter.segment(event.title)].length;
            return (
              <li
                key={event.date}
                data-timeline-event={String(index)}
                data-timeline-revealed={isVisible}
                // Reveal styles key off the attribute, so the TOC peek can
                // show a not-yet-revealed event finished by flipping it.
                className="group/event relative pl-12 sm:pl-14"
              >
                {/* A short hand-drawn branch from the rail to the dot. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 40 8"
                  preserveAspectRatio="none"
                  className="text-primary absolute top-2 left-0 h-2 w-8 overflow-visible sm:w-10"
                >
                  <path
                    d="M0 4.5 C 9 2.5, 20 6, 31 3.6 S 38 3.2, 40 4"
                    pathLength={1}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className="transition-[stroke-dashoffset] duration-500 ease-out [stroke-dasharray:1_1] [stroke-dashoffset:1] group-data-[timeline-revealed=true]/event:[stroke-dashoffset:0] motion-reduce:transition-none"
                  />
                </svg>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 left-8 size-2 rounded-full transition-[background-color,box-shadow,transform,opacity] delay-300 duration-500 sm:left-10",
                    "bg-border scale-75 opacity-0 motion-reduce:scale-100",
                    "group-data-[timeline-revealed=true]/event:bg-primary group-data-[timeline-revealed=true]/event:scale-125 group-data-[timeline-revealed=true]/event:opacity-100 group-data-[timeline-revealed=true]/event:shadow-[0_0_0_5px_color-mix(in_oklch,var(--primary)_8%,transparent),0_0_18px_color-mix(in_oklch,var(--primary)_30%,transparent)]",
                  )}
                />

                <time
                  className={cn(
                    "text-primary mt-1 block text-xs font-bold tracking-[0.12em] capitalize opacity-0 motion-reduce:opacity-100",
                    "group-data-[timeline-revealed=true]/event:opacity-100 group-data-[timeline-revealed=true]/event:motion-safe:animate-[lp-story-date-in_420ms_cubic-bezier(0.22,1,0.36,1)_both]",
                  )}
                >
                  {event.date}
                </time>
                <TypedTitle title={event.title} visible={isVisible} />
                <p
                  className={cn(
                    "text-muted-foreground mt-2 max-w-xl leading-[1.7] opacity-0 motion-reduce:opacity-100",
                    "group-data-[timeline-revealed=true]/event:opacity-100 group-data-[timeline-revealed=true]/event:motion-safe:animate-[lp-story-description-in_650ms_cubic-bezier(0.22,1,0.36,1)_both]",
                  )}
                  style={{
                    animationDelay: `${(TYPE_START + titleLength * typeStep(titleLength) + 120).toString()}ms`,
                  }}
                >
                  <StoryText text={event.text} link={event.link} />
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </LandingSection>
  );
}
