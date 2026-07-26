"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import {
  GradesPreviewSurface,
  QuizPreviewSurface,
} from "@/components/testownik-preview/product-surfaces";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../../components/focus";
import { LandingSection } from "../../components/section";
import {
  DisplayHeading,
  Eyebrow,
  MonoLabel,
} from "../../components/typography";
import { AiDemo } from "./ai-demo";
import { demoPanelVariants } from "./demo-panel-variants";
import { SharingDemo } from "./sharing-demo";
import { SHOWCASE_FEATURES } from "./showcase-features";
import type { ShowcaseFeatureId } from "./showcase-features";
import { ShowcaseWindow } from "./showcase-window";

function ShowcaseScene({
  feature,
}: {
  feature: ShowcaseFeatureId;
}): React.JSX.Element {
  switch (feature) {
    case "grades": {
      return <GradesPreviewSurface className={demoPanelVariants()} />;
    }
    case "sharing": {
      return <SharingDemo />;
    }
    case "ai": {
      return <AiDemo />;
    }
    case "quiz": {
      return <QuizPreviewSurface className={demoPanelVariants()} />;
    }
  }
}

export function ProductShowcase(): React.JSX.Element {
  const [activeId, setActiveId] = useState<ShowcaseFeatureId>("quiz");
  const active =
    SHOWCASE_FEATURES.find((feature) => feature.id === activeId) ??
    SHOWCASE_FEATURES[0];

  return (
    <LandingSection id="features" padding="showcase">
      <header className="grid grid-cols-1 items-end gap-x-20 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <Eyebrow className="col-span-full">PRODUKT / NA ŻYWO</Eyebrow>
        <DisplayHeading className="mt-0">
          Nie slajdy.
          <br />
          <em>Prawdziwe narzędzia.</em>
        </DisplayHeading>
        <p className="text-muted-foreground max-w-[34rem] text-[1.05rem] leading-[1.6]">
          Kliknij wszystko. To nie są ilustracje funkcji — każda scena odtwarza
          zachowanie istniejącego ekranu Testownika.
        </p>
      </header>

      <div className="border-border mt-10 flex overflow-x-auto rounded-t-[0.9rem] border [scrollbar-width:none] sm:mt-18 sm:grid sm:grid-cols-4 sm:overflow-hidden">
        {SHOWCASE_FEATURES.map((feature) => (
          <button
            type="button"
            key={feature.id}
            aria-pressed={activeId === feature.id}
            onClick={() => {
              setActiveId(feature.id);
            }}
            className={cn(
              "border-border bg-card text-foreground group relative flex min-h-[6.2rem] flex-col items-start justify-center gap-[0.35rem] border-r px-[1.2rem] py-4 text-left last:border-r-0",
              "hover:bg-secondary aria-pressed:bg-secondary",
              "min-h-20 min-w-40 sm:min-h-[6.2rem] sm:min-w-0",
              FOCUS_RING,
              // Inset, because the tabs share edges with the stage below them.
              "focus-visible:outline-offset-[-3px]",
            )}
          >
            <MonoLabel size="xs" className="font-normal">
              {feature.kicker}
            </MonoLabel>
            <strong className="text-[0.92rem]">{feature.label}</strong>
            <ArrowRight
              aria-hidden="true"
              className="text-muted-foreground absolute right-[0.85rem] bottom-[0.85rem] size-[0.9rem]"
            />
            <span className="bg-primary absolute inset-x-0 bottom-0 h-[0.22rem] origin-left scale-x-0 transition-transform duration-[240ms] group-aria-pressed:scale-x-100" />
          </button>
        ))}
      </div>

      <div className="border-border bg-secondary grid min-h-0 grid-cols-1 overflow-hidden rounded-b-[0.9rem] border border-t-0 lg:min-h-[50rem] lg:grid-cols-[minmax(18rem,0.35fr)_minmax(0,1fr)]">
        <div className="border-border bg-card block border-b p-6 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2 sm:px-[2.4rem] sm:py-12 lg:flex lg:flex-col lg:border-r lg:border-b-0">
          <MonoLabel tone="primary" className="sm:col-start-1">
            {active.kicker}
          </MonoLabel>
          <h3 className="mt-[1.2rem] text-[2rem] leading-[0.98] tracking-[-0.055em] sm:col-start-1 sm:text-[clamp(2rem,3vw,3.4rem)]">
            {active.title}
          </h3>
          <p className="text-muted-foreground mt-[1.4rem] leading-[1.6] sm:col-start-2 sm:row-span-2 sm:row-start-1">
            {active.description}
          </p>
          <MonoLabel
            size="xs"
            className="[&_svg]:text-primary mt-auto hidden items-center gap-[0.55rem] pt-8 lg:flex [&_svg]:size-4"
          >
            {active.badge}
            <span>INTERAKTYWNY PODGLĄD</span>
          </MonoLabel>
        </div>

        <ShowcaseWindow path={active.id}>
          <ShowcaseScene feature={active.id} />
        </ShowcaseWindow>
      </div>
    </LandingSection>
  );
}
