import { cn } from "@/lib/utils";

import { LandingSection } from "../components/section";
import { DisplayHeading, Eyebrow, MonoLabel } from "../components/typography";

const CLAIMS = ["BEZ REJESTRACJI", "OPEN SOURCE", "NA KAŻDYM URZĄDZENIU"];

export function Manifesto(): React.JSX.Element {
  return (
    <LandingSection
      id="product"
      className={cn(
        "grid grid-cols-1 items-end gap-10 sm:gap-[8vw] lg:grid-cols-[1.2fr_0.8fr]",
      )}
    >
      <div>
        <Eyebrow>NARZĘDZIE DO PRAWDZIWEJ SESJI</Eyebrow>
        <DisplayHeading>
          Jedno miejsce.
          <br />
          <em>Cały proces nauki.</em>
        </DisplayHeading>
      </div>

      <div>
        <p className="text-muted-foreground text-[clamp(1.05rem,1.7vw,1.35rem)] leading-[1.55]">
          Importujesz materiały, odpowiadasz, wracasz do błędów, obserwujesz
          wyniki i dzielisz quiz z grupą. Bez przełączania pięciu aplikacji.
        </p>
        <div className="mt-8 flex flex-wrap gap-[0.55rem]">
          {CLAIMS.map((claim) => (
            <MonoLabel
              key={claim}
              tone="default"
              className="border-border rounded-full border px-3 py-[0.58rem]"
            >
              {claim}
            </MonoLabel>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
