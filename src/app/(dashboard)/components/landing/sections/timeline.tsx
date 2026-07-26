import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { LandingSection } from "../components/section";
import { DisplayHeading, Eyebrow } from "../components/typography";
import { monoLabelVariants } from "../components/typography-variants";
import { SOLVRO_PORTFOLIO_URL, STORY } from "../landing-content";

export function Timeline(): React.JSX.Element {
  return (
    <LandingSection
      id="story"
      className={cn(
        "grid grid-cols-1 gap-12 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-[7vw]",
      )}
    >
      <header className="self-start lg:sticky lg:top-32">
        <Eyebrow>HISTORIA TESTOWNIKA</Eyebrow>
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

      <ol>
        {STORY.map((event, index) => (
          <li
            key={event.date}
            className="border-border grid grid-cols-[2rem_1fr] gap-4 border-t py-[2.2rem] sm:grid-cols-[2.5rem_8rem_1fr]"
          >
            <span className={monoLabelVariants()}>
              {(index + 1).toString().padStart(2, "0")}
            </span>
            <time
              className={cn(monoLabelVariants(), "col-start-2 sm:col-auto")}
            >
              {event.date}
            </time>
            <div className="col-start-2 sm:col-auto">
              <h3 className="text-[clamp(1.35rem,2vw,2rem)] tracking-[-0.03em]">
                {event.title}
              </h3>
              <p className="text-muted-foreground mt-[0.8rem] leading-[1.55]">
                {event.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

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
