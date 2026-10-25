"use client";

import { ArrowRightIcon } from "lucide-react";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { DESKTOP_STAGE_QUERY } from "../../breakpoints";
import { FOCUS_RING } from "../../ui/focus";
import { LandingButtonLink } from "../../ui/landing-button";
import { LandingSection } from "../../ui/section";
import { DisplayHeading } from "../../ui/typography";
import { SHOWCASE_FEATURES } from "./showcase-features";
import type { ShowcaseFeatureId } from "./showcase-features";
import { ShowcaseSessionProvider } from "./showcase-session";

const AiDemo = dynamic(async () => import("./ai-demo").then((m) => m.AiDemo));
const QuizDemo = dynamic(async () =>
  import("./quiz-demo").then((m) => m.QuizDemo),
);
const GradesDemo = dynamic(async () =>
  import("./grades-demo").then((m) => m.GradesDemo),
);
const StatsDemo = dynamic(async () =>
  import("./stats-demo").then((m) => m.StatsDemo),
);

/** Fetch the other panels while idle, so a switch never shows an empty one. */
function preloadDemos(): void {
  void import("./ai-demo");
  void import("./grades-demo");
  void import("./stats-demo");
}

function ShowcaseScene({
  feature,
}: {
  feature: ShowcaseFeatureId;
}): React.JSX.Element {
  switch (feature) {
    case "ai": {
      return <AiDemo />;
    }
    case "quiz": {
      return <QuizDemo />;
    }
    case "grades": {
      return <GradesDemo />;
    }
    case "stats": {
      return <StatsDemo />;
    }
  }
}

/** Shared top inset so the "0X" stays on one Y across open/closed. */
const RAIL_TOP = "lg:pt-6";

const showcaseBackdropStyle: CSSProperties = {
  backgroundImage:
    "radial-gradient(ellipse at 12% 18%, color-mix(in oklab, var(--primary) 24%, transparent), transparent 42%), radial-gradient(ellipse at 88% 82%, color-mix(in oklab, var(--chart-6) 10%, transparent), transparent 38%), linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
  backgroundSize: "auto, auto, 4rem 4rem, 4rem 4rem",
};

export function ProductShowcase(): React.JSX.Element {
  const [activeId, setActiveId] = useState<ShowcaseFeatureId>("quiz");
  const keyboardSelectionReference = useRef<ShowcaseFeatureId | null>(null);
  const tapSelectionReference = useRef<ShowcaseFeatureId | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(preloadDemos, 1500);
    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <LandingSection
      id="features"
      // The skip link's target: focusable so activation moves focus here.
      tabIndex={-1}
      padding="showcase"
      showPlaceholder={false}
      className="scroll-mt-[5rem] outline-none"
    >
      <header className="grid grid-cols-1 items-end gap-x-20 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <DisplayHeading className="mt-0">
          Zobacz, jak
          <br />
          <em>działa nauka.</em>
        </DisplayHeading>
        <p className="text-muted-foreground max-w-[34rem] text-[1.05rem] leading-[1.65]">
          Quizy, asystent AI, średnia ocen i&nbsp;statystyki to tylko kilka
          z&nbsp;wielu funkcji.
        </p>
      </header>

      <ShowcaseSessionProvider>
        <div className="border-border bg-card @container mt-10 overflow-hidden rounded-[1.1rem] border sm:mt-16 lg:flex lg:h-[47rem]">
          {SHOWCASE_FEATURES.map((feature, index) => {
            const active = feature.id === activeId;
            const panelId = `landing-feature-${feature.id}`;
            const number = String(index + 1).padStart(2, "0");

            return (
              <article
                key={feature.id}
                className={cn(
                  "border-border relative min-w-0 border-b last:border-b-0 lg:h-full lg:overflow-hidden lg:border-r lg:border-b-0 lg:last:border-r-0",
                  "transition-[width,flex] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  active ? "lg:flex-1" : "lg:w-[4.75rem] lg:flex-none",
                )}
              >
                <button
                  type="button"
                  aria-expanded={active}
                  aria-controls={panelId}
                  onClick={(event) => {
                    const desktop =
                      window.matchMedia(DESKTOP_STAGE_QUERY).matches;
                    // The expanded desktop rail disappears. Keep keyboard
                    // focus in the selected panel instead of dropping to body.
                    if (event.detail === 0 && desktop) {
                      keyboardSelectionReference.current = feature.id;
                    }
                    // In the stacked accordion the closing card above can
                    // push the opened one far down; bring its header back up.
                    if (event.detail !== 0 && !desktop && !active) {
                      tapSelectionReference.current = feature.id;
                    }
                    setActiveId(feature.id);
                  }}
                  className={cn(
                    "bg-card hover:bg-secondary flex h-16 w-full items-center justify-between gap-4 px-5 text-left transition-colors",
                    RAIL_TOP,
                    "lg:absolute lg:inset-0 lg:z-10 lg:h-full lg:flex-col lg:items-center lg:px-0 lg:pb-6",
                    active &&
                      "bg-secondary/60 lg:pointer-events-none lg:hidden",
                    FOCUS_RING,
                    "focus-visible:outline-offset-[-3px]",
                  )}
                >
                  <span className="text-primary text-sm font-bold tabular-nums">
                    {number}
                  </span>
                  <span className="text-sm font-bold lg:mt-auto lg:rotate-180 lg:[writing-mode:vertical-rl]">
                    {feature.label}
                  </span>
                </button>

                {active ? (
                  <div
                    id={panelId}
                    ref={(panel) => {
                      if (panel === null) {
                        return;
                      }
                      if (keyboardSelectionReference.current === feature.id) {
                        keyboardSelectionReference.current = null;
                        panel.focus({ preventScroll: true });
                      }
                      if (tapSelectionReference.current === feature.id) {
                        tapSelectionReference.current = null;
                        const reduceMotion = window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches;
                        panel.parentElement?.scrollIntoView({
                          block: "start",
                          behavior: reduceMotion ? "auto" : "smooth",
                        });
                      }
                    }}
                    role="region"
                    aria-label={feature.label}
                    tabIndex={-1}
                    className={cn(
                      "grid min-h-0 lg:h-full lg:grid-cols-[minmax(17rem,0.64fr)_minmax(0,1.65fr)]",
                      // Fades and rises in behind the widening rail instead
                      // of popping into place at once.
                      "animate-[lp-panel-in_520ms_cubic-bezier(0.22,1,0.36,1)_80ms_both] motion-reduce:animate-none",
                      // Laid out at its final width from the first frame; the
                      // article's animating width only clips it. The three
                      // rails are 4.75rem each, plus this article's 1px border.
                      index === SHOWCASE_FEATURES.length - 1
                        ? "lg:w-[calc(100cqw-14.25rem)]"
                        : "lg:w-[calc(100cqw-14.25rem-1px)]",
                      FOCUS_RING,
                      "focus-visible:outline-offset-[-3px]",
                    )}
                  >
                    <div
                      className={cn(
                        "bg-card flex flex-col px-6 pb-6 sm:px-9 sm:pb-9 lg:px-10 lg:pb-10",
                        RAIL_TOP,
                      )}
                    >
                      <div className="hidden items-center gap-3 lg:flex">
                        <span className="text-primary text-sm font-bold tabular-nums">
                          {number}
                        </span>
                        <span className="text-primary hidden text-sm font-bold lg:inline">
                          {feature.label}
                        </span>
                      </div>
                      <h3 className="mt-6 text-5xl leading-[0.98] font-[750] tracking-[-0.055em] lg:mt-8 lg:text-[clamp(2.5rem,3.35vw,3rem)]">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground mt-6 text-[0.98rem] leading-[1.7]">
                        {feature.description}
                      </p>
                      <LandingButtonLink
                        href="/login?redirect=%2Fquizzes"
                        className="border-border bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground mt-8 min-h-10 w-fit max-w-full rounded-lg border px-4 text-[0.88rem] font-semibold tracking-[-0.01em] normal-case"
                      >
                        <span className="truncate">{feature.cta}</span>
                        <ArrowRightIcon aria-hidden="true" />
                      </LandingButtonLink>
                    </div>

                    <div
                      className="bg-background relative min-h-0 overflow-hidden p-2 sm:p-6 lg:p-8"
                      style={showcaseBackdropStyle}
                    >
                      <div className="relative h-full">
                        <ShowcaseScene feature={feature.id} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </ShowcaseSessionProvider>
    </LandingSection>
  );
}
