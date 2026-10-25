import type { CSSProperties } from "react";

import { HERO_PROGRESS, attachHeroProgress } from "../hero-progress";

const glowStyle: CSSProperties = {
  opacity: `calc(0.16 + ${HERO_PROGRESS} * 0.2)`,
  transform: `translate(-50%, -50%) scale(calc(0.86 + ${HERO_PROGRESS} * 0.16))`,
};

/**
 * The soft primary glow behind the device stack. The static hero (server
 * markup, and desktop until the stage chunk arrives) renders it at the closed
 * pose, so it is there from the first paint rather than appearing with the
 * scene.
 */
export function DeviceSceneBackdrop({
  isStatic,
}: {
  isStatic: boolean;
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      data-hero-progress={isStatic ? undefined : true}
      ref={isStatic ? undefined : attachHeroProgress}
      style={
        isStatic
          ? { opacity: 0.16, transform: "translate(-50%, -50%) scale(0.86)" }
          : glowStyle
      }
      className="bg-primary/16 absolute top-[63%] left-[56%] hidden h-[25rem] w-[min(74vw,72rem)] rounded-full blur-[90px] lg:block"
    />
  );
}
