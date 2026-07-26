import { cn } from "@/lib/utils";

import { LandingSection } from "../components/section";
import { DisplayHeading, Eyebrow, MonoLabel } from "../components/typography";
import { CAPABILITIES } from "../landing-content";

function formatIndex(index: number): string {
  return (index + 1).toString().padStart(2, "0");
}

export function Capabilities(): React.JSX.Element {
  return (
    <LandingSection>
      <header className="max-w-[60rem]">
        <Eyebrow>DZIAŁA DZISIAJ</Eyebrow>
        <DisplayHeading>
          Funkcje, które
          <br />
          <em>mają sens razem.</em>
        </DisplayHeading>
      </header>

      <div className="border-border mt-12 grid grid-cols-1 border-t border-l sm:mt-20 sm:grid-cols-2">
        {CAPABILITIES.map((capability, index) => (
          <article
            key={capability.tag}
            className={cn(
              "border-border bg-background relative min-h-[26rem] border-r border-b p-[2.4rem]",
              "hover:bg-card transition-[background-color,transform] duration-[250ms] hover:z-1 hover:-translate-y-[0.4rem]",
              "min-h-80 p-6 sm:min-h-[26rem] sm:p-[2.4rem]",
            )}
          >
            <MonoLabel className="absolute top-8 right-8">
              {formatIndex(index)}
            </MonoLabel>
            <capability.icon
              aria-hidden="true"
              className="text-primary size-[2.6rem]"
            />
            <MonoLabel tone="primary" className="mt-12 block sm:mt-16">
              {capability.tag}
            </MonoLabel>
            <h3 className="mt-[0.8rem] max-w-[28rem] text-[clamp(1.9rem,3vw,3rem)] leading-none tracking-[-0.045em]">
              {capability.title}
            </h3>
            <p className="text-muted-foreground mt-[1.4rem] max-w-[32rem] leading-[1.6]">
              {capability.text}
            </p>
          </article>
        ))}
      </div>
    </LandingSection>
  );
}
