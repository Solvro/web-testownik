import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookMarkedIcon,
  GraduationCap,
  NotebookPenIcon,
  Sparkles,
  TestTubeDiagonalIcon,
  Users,
  Zap,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HERO_PROGRESS } from "../hero-progress";

/**
 * Flat DOM that frames the device stack, deliberately rendered inside the
 * Bubble so the droplet refracts it along with the rest of the hero copy.
 *
 * Both groups are driven straight off `--landing-hero-progress` in CSS: the
 * study badges fade out as the lid starts to open, the product badges fade in
 * once it is most of the way there. Doing it in CSS keeps the whole choreography
 * off the React render path.
 */

/** Fades in over the second half of the opening. */
const productBadgeStyle: CSSProperties = {
  opacity: `clamp(0, calc((${HERO_PROGRESS} - 0.5) / 0.22), 1)`,
};

interface ProductBadge {
  id: string;
  icon: LucideIcon;
  label: ReactNode;
  /** Placement plus the hand-set tilt that keeps the group from reading as a grid. */
  className: string;
}

const PRODUCT_BADGES: ProductBadge[] = [
  {
    id: "streak",
    icon: Zap,
    label: (
      <>
        <b className="text-foreground font-bold">7 dni</b> serii
      </>
    ),
    className: "top-[18%] left-[12%] hidden rotate-[-4deg] xl:inline-flex",
  },
  {
    id: "ai",
    icon: Sparkles,
    label: "Podpowiedź AI gotowa",
    className: "top-[11%] right-[14%] rotate-[3deg]",
  },
  {
    id: "share",
    icon: Users,
    label: (
      <>
        <b className="text-foreground font-bold">10</b> osób w quizie
      </>
    ),
    className: "bottom-[24%] left-[9%] rotate-[2deg]",
  },
  {
    id: "alert",
    icon: Bell,
    label: (
      <>
        Powtórka za <b className="text-foreground font-bold">2 h</b>
      </>
    ),
    className: "right-[10%] bottom-[20%] hidden rotate-[-3deg] xl:inline-flex",
  },
];

interface StudyBadge {
  id: string;
  icon: LucideIcon;
  className: string;
  rotation: string;
}

const STUDY_BADGES: StudyBadge[] = [
  {
    id: "notebook",
    icon: NotebookPenIcon,
    className: "top-[24%] right-[20%] hidden xl:grid",
    rotation: "7deg",
  },
  {
    id: "flask",
    icon: TestTubeDiagonalIcon,
    className: "top-[38%] right-[10%]",
    rotation: "-6deg",
  },
  {
    id: "books",
    icon: BookMarkedIcon,
    className: "bottom-[25%] left-[12%]",
    rotation: "-8deg",
  },
  {
    id: "cap",
    icon: GraduationCap,
    className: "bottom-[38%] left-[20%] hidden xl:grid",
    rotation: "6deg",
  },
];

export function HeroBadges(): React.JSX.Element {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-15 hidden sm:block"
      >
        {PRODUCT_BADGES.map(({ id, icon: Icon, label, className }) => (
          <span
            key={id}
            style={productBadgeStyle}
            className={cn(
              "border-border bg-card/92 text-muted-foreground absolute inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[0.72rem] font-medium whitespace-nowrap shadow-[0_1.2rem_2.4rem_-1.2rem_rgb(0_0_0/0.4)]",
              "[&_svg]:text-primary [&_svg]:size-[0.85rem]",
              className,
            )}
          >
            <Icon />
            {label}
          </span>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-16 hidden sm:block"
      >
        {STUDY_BADGES.map(({ id, icon: Icon, className, rotation }) => (
          <span
            key={id}
            style={
              {
                // Fade runs backwards: fully out before the lid moves, gone by
                // the time the laptop is open.
                "--reveal": `clamp(0, calc((0.46 - ${HERO_PROGRESS}) / 0.16), 1)`,
                opacity: "var(--reveal)",
                transform:
                  "translateY(calc((1 - var(--reveal)) * -1.4rem))" +
                  ` rotate(${rotation})` +
                  " scale(calc(0.72 + var(--reveal) * 0.28))",
              } as CSSProperties
            }
            className={cn(
              "border-border bg-card/90 absolute grid size-[3.35rem] place-items-center rounded-2xl border shadow-[0_1.5rem_2.8rem_-1.2rem_rgb(0_0_0/0.42)]",
              "[&_svg]:text-primary [&_svg]:size-[1.45rem]",
              className,
            )}
          >
            <Icon />
          </span>
        ))}
      </div>
    </>
  );
}
