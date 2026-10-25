import type { CSSProperties } from "react";

import { HERO_PROGRESS, attachHeroProgress } from "../hero-progress";
import { Eyebrow } from "../ui/typography";

const progressBarStyle: CSSProperties = {
  transform: `scaleX(${HERO_PROGRESS})`,
};

/**
 * "Przewiń ... otwórz Testownik" along the bottom of the desktop stage, with
 * a bar that fills as the laptop opens. The static hero renders it too, at
 * zero, so it is there before the stage chunk arrives.
 */
export function HeroScrollHint({
  isStatic = false,
}: {
  isStatic?: boolean;
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="absolute bottom-[1.3rem] left-1/2 z-20 hidden -translate-x-1/2 items-center gap-[0.8rem] lg:flex"
    >
      <Eyebrow>PRZEWIŃ</Eyebrow>
      <span className="bg-border relative block h-px w-36 overflow-hidden">
        <span
          data-hero-progress={isStatic ? undefined : true}
          ref={isStatic ? undefined : attachHeroProgress}
          style={isStatic ? { transform: "scaleX(0)" } : progressBarStyle}
          className="bg-primary absolute inset-0 origin-left"
        />
      </span>
      <Eyebrow>OTWÓRZ TESTOWNIK</Eyebrow>
    </div>
  );
}
