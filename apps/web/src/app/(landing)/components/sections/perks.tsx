"use client";

import Image from "next/image";
import { Suspense, use, useEffect, useRef } from "react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import snapshot from "../../data/perks.snapshot.json";
import type { PerksData } from "../../lib/perks";
import { trackUmamiEvent } from "../../lib/umami";
import { PERKS_COPY, PERKS_VARIANT, perksLead } from "../landing-content";
import { uniperksWordmarkDark, uniperksWordmarkLight } from "../logos";
import { FOCUS_RING } from "../ui/focus";
import { DisplayHeading, MonoLabel } from "../ui/typography";
import { PerksCards, PerksCardsSkeleton } from "./perks-cards";

/*
 * The partner's ground rather than our graph paper. Everything inside reads
 * these variables; `--perk-accent` fills (CTA, front card) and
 * `--perk-accent-ink` is the accent as text, lighter in dark mode where the
 * fill purple would not reach 3:1 on the ground.
 */
const PERK_THEME = cn(
  "[--perk-bg:#F7F4FC] [--perk-fg:#230547] [--perk-muted:#57576B] [--perk-card:#FFFFFF] [--perk-border:#E4DCF2] [--perk-accent:#6626CD] [--perk-accent-ink:#6626CD] [--perk-accent-fg:#FFFFFF] [--perk-halo:#E9DDFB]",
  "dark:[--perk-bg:#170634] dark:[--perk-fg:#F7F4FC] dark:[--perk-muted:#BBAEDB] dark:[--perk-card:#2A1152] dark:[--perk-border:#3A2566] dark:[--perk-accent-ink:#B794F6] dark:[--perk-halo:#3A1F66]",
);

/** The single soft halo, top right. */
const haloStyle: CSSProperties = {
  backgroundImage:
    "radial-gradient(ellipse 70% 80% at 100% 0%, var(--perk-halo), transparent 68%)",
};

const numberFormat = new Intl.NumberFormat("pl-PL");

function formatted(
  data: Pick<
    PerksData,
    "studentsCount" | "offersCount" | "maxDiscountPct" | "yearlySavingsPln"
  >,
) {
  return {
    students: numberFormat.format(data.studentsCount),
    offers: numberFormat.format(data.offersCount),
    maxDiscount: numberFormat.format(data.maxDiscountPct),
    savings: numberFormat.format(data.yearlySavingsPln),
  };
}

/*
 * The skeletons render the snapshot's text in transparent ink over a block,
 * so the streamed numbers land in the same lines and nothing shifts.
 */
const PENDING_TEXT =
  "rounded-[6px] bg-(--perk-border) text-transparent select-none [box-decoration-break:clone]";
const snapshotNumbers = formatted(snapshot);

const LEAD_CLASS =
  "mt-6 max-w-[32rem] text-[17px] leading-relaxed text-pretty text-(--perk-muted) lg:text-[18px]";

function PerksLead({
  perks,
}: {
  perks: Promise<PerksData>;
}): React.JSX.Element {
  return <p className={LEAD_CLASS}>{perksLead(formatted(use(perks)))}</p>;
}

function PerksStatsRow({
  numbers,
  pending = false,
}: {
  numbers: ReturnType<typeof formatted>;
  pending?: boolean;
}): React.JSX.Element {
  const cells = [
    { value: numbers.students, caption: PERKS_COPY.studentsCaption },
    {
      value: numbers.offers,
      caption: PERKS_COPY.offersCaption(numbers.maxDiscount),
    },
    { value: `${numbers.savings}\u00A0zł`, caption: PERKS_COPY.savingsCaption },
  ];
  return (
    <dl
      aria-hidden={pending || undefined}
      className="grid grid-cols-3 gap-4 border-t border-(--perk-border) pt-6"
    >
      {cells.map((cell) => (
        <div key={cell.caption} className="flex min-w-0 flex-col-reverse gap-1">
          <dt className="text-[13px] leading-snug text-(--perk-muted)">
            <span className={cn(pending && PENDING_TEXT)}>{cell.caption}</span>
          </dt>
          <dd className="text-[1.375rem] leading-[1.1] font-bold tracking-[-0.035em] whitespace-nowrap tabular-nums lg:text-[2.25rem]">
            <span className={cn(pending && PENDING_TEXT)}>{cell.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PerksStats({
  perks,
}: {
  perks: Promise<PerksData>;
}): React.JSX.Element {
  const data = use(perks);
  const source = `${data.source}@${data.fetchedAt}`;
  return (
    <div
      // Debugging only: which source won and when it was read, on the
      // section. Never visible.
      ref={(node) => {
        node?.closest("section")?.setAttribute("data-perks-source", source);
      }}
    >
      <PerksStatsRow numbers={formatted(data)} />
    </div>
  );
}

function PerksCardStack({
  perks,
}: {
  perks: Promise<PerksData>;
}): React.JSX.Element {
  return <PerksCards offers={use(perks).offers} />;
}

export function Perks({
  perks,
}: {
  /** Unresolved: the shell and headline render first, the numbers stream in. */
  perks: Promise<PerksData>;
}): React.JSX.Element {
  const stackReference = useRef<HTMLDivElement>(null);

  // One view per page load, once half the card stack is on screen. Umami
  // loads lazily, so an early crossing waits for the next one.
  useEffect(() => {
    const stack = stackReference.current;
    if (stack === null) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          trackUmamiEvent("perks-view", { variant: PERKS_VARIANT })
        ) {
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(stack);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section
      id="perks"
      className={cn(
        PERK_THEME,
        "relative isolate w-full scroll-mt-[5rem] bg-(--perk-bg) px-4 py-12 text-(--perk-fg) sm:px-[max(1.5rem,calc((100vw-96rem)/2))] sm:py-20",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={haloStyle}
      />
      <div className="grid gap-y-10 lg:grid-cols-2 lg:gap-x-16">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center gap-3">
            <MonoLabel size="md" className="text-(--perk-muted)">
              {PERKS_COPY.eyebrow}
            </MonoLabel>
            <span aria-hidden="true" className="h-px w-8 bg-(--perk-border)" />
            <Image
              src={uniperksWordmarkLight}
              alt="uniperks"
              className="h-[22px] w-auto dark:hidden"
            />
            <Image
              src={uniperksWordmarkDark}
              alt="uniperks"
              className="hidden h-[22px] w-auto dark:block"
            />
          </div>
          <DisplayHeading className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] font-bold tracking-[-0.035em] sm:text-[clamp(2.4rem,5vw,4rem)] [&_em]:text-(--perk-accent-ink)">
            {PERKS_COPY.headline}
            <br />
            <em>{PERKS_COPY.headlineAccent}</em>
          </DisplayHeading>
          <Suspense
            fallback={
              <p aria-hidden="true" className={LEAD_CLASS}>
                <span className={PENDING_TEXT}>
                  {perksLead(snapshotNumbers)}
                </span>
              </p>
            }
          >
            <PerksLead perks={perks} />
          </Suspense>
        </div>

        <div
          ref={stackReference}
          aria-hidden="true"
          className="group/perks relative mx-auto h-[330px] w-full max-w-[318px] lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:h-[30rem] lg:max-w-[34rem] lg:self-center"
        >
          <Suspense fallback={<PerksCardsSkeleton />}>
            <PerksCardStack perks={perks} />
          </Suspense>
        </div>

        <div className="flex flex-col items-stretch gap-4 lg:col-start-1 lg:row-start-2 lg:flex-row lg:items-center">
          <a
            href="/go/uniperks?p=landing-cta"
            target="_blank"
            rel="noopener sponsored"
            data-umami-event="perks-click"
            data-umami-event-placement="landing-cta"
            className={cn(
              "inline-flex min-h-13 items-center justify-center rounded-full bg-(--perk-accent) px-6 text-base font-semibold text-(--perk-accent-fg) transition-colors hover:bg-(--perk-accent)/90",
              FOCUS_RING,
            )}
          >
            {PERKS_COPY.primaryCta}
          </a>
          <a
            href="/go/uniperks?p=landing-secondary"
            target="_blank"
            rel="noopener sponsored"
            data-umami-event="perks-click"
            data-umami-event-placement="landing-secondary"
            className={cn(
              "self-center rounded-sm text-base font-semibold text-(--perk-fg) underline underline-offset-4",
              "lg:inline-flex lg:min-h-13 lg:items-center lg:rounded-full lg:border lg:border-(--perk-border) lg:bg-(--perk-card) lg:px-6 lg:no-underline lg:transition-colors lg:hover:border-(--perk-accent-ink) lg:dark:bg-transparent",
              FOCUS_RING,
            )}
          >
            {PERKS_COPY.secondaryCta}
          </a>
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-3">
          <Suspense
            fallback={<PerksStatsRow numbers={snapshotNumbers} pending />}
          >
            <PerksStats perks={perks} />
          </Suspense>
        </div>

        <p className="text-[12px] leading-relaxed text-(--perk-muted) lg:col-span-2 lg:row-start-4">
          {PERKS_COPY.disclosure}
        </p>
      </div>
    </section>
  );
}
