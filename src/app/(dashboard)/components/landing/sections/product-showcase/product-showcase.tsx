"use client";

import { ArrowRightIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../../components/focus";
import { LandingButtonLink } from "../../components/landing-button";
import { LandingSection } from "../../components/section";
import { DisplayHeading } from "../../components/typography";
import { SHOWCASE_FEATURES } from "./showcase-features";
import type { ShowcaseFeatureId } from "./showcase-features";

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

export function ProductShowcase(): React.JSX.Element {
  const [activeId, setActiveId] = useState<ShowcaseFeatureId>("quiz");

  return (
    <LandingSection
      id="features"
      padding="showcase"
      showPlaceholder={false}
      className="scroll-mt-4"
    >
      <header className="grid grid-cols-1 items-end gap-x-20 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <DisplayHeading className="mt-0">
          Zobacz, jak
          <br />
          <em>działa nauka.</em>
        </DisplayHeading>
        <p className="text-muted-foreground max-w-[34rem] text-[1.05rem] leading-[1.65]">
          To nie są zrzuty ekranu. Wybieraj odpowiedzi, rozmawiaj z asystentem,
          zmieniaj oceny i sprawdzaj statystyki — dokładnie tak, jak w
          Testowniku.
        </p>
      </header>

      <div className="border-border bg-card mt-10 overflow-hidden rounded-[1.1rem] border sm:mt-16 lg:flex lg:h-[50rem]">
        {SHOWCASE_FEATURES.map((feature, index) => {
          const active = feature.id === activeId;
          const panelId = `landing-feature-${feature.id}`;
          const number = String(index + 1).padStart(2, "0");

          return (
            <article
              key={feature.id}
              className={cn(
                "border-border relative min-w-0 border-b last:border-b-0 lg:h-full lg:border-r lg:border-b-0 lg:last:border-r-0",
                "transition-[width,flex] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active ? "lg:flex-1" : "lg:w-[4.75rem] lg:flex-none",
              )}
            >
              <button
                type="button"
                aria-expanded={active}
                aria-controls={panelId}
                onClick={() => {
                  setActiveId(feature.id);
                }}
                className={cn(
                  "bg-card hover:bg-secondary flex h-16 w-full items-center justify-between gap-4 px-5 text-left transition-colors",
                  RAIL_TOP,
                  "lg:absolute lg:inset-0 lg:z-10 lg:h-full lg:flex-col lg:items-center lg:px-0 lg:pb-6",
                  active && "bg-secondary/60 lg:pointer-events-none lg:hidden",
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
                  className="grid min-h-0 lg:h-full lg:grid-cols-[minmax(17rem,0.64fr)_minmax(0,1.65fr)]"
                >
                  <div
                    className={cn(
                      "bg-card flex flex-col px-6 pb-6 sm:px-9 sm:pb-9 lg:px-10 lg:pb-10",
                      RAIL_TOP,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-primary text-sm font-bold tabular-nums">
                        {number}
                      </span>
                      <span className="text-primary hidden text-sm font-bold lg:inline">
                        {feature.label}
                      </span>
                    </div>
                    <h3 className="mt-6 text-[clamp(2rem,3.2vw,3.65rem)] leading-[0.98] font-[750] tracking-[-0.055em] lg:mt-8">
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
                    <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                      Przejdź do pełnej wersji
                    </p>
                  </div>

                  <div className="bg-secondary min-h-0 p-3 sm:p-6 lg:p-8">
                    <ShowcaseScene feature={feature.id} />
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </LandingSection>
  );
}
