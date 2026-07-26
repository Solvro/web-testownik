import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const landingSectionVariants = cva(
  "mx-auto w-[calc(100%-2rem)] sm:w-[min(100%-3rem,88rem)]",
  {
    variants: {
      padding: {
        default: "py-24 sm:py-36",
        showcase: "pt-12 pb-24 sm:pb-36",
        none: "",
      },
    },
    defaultVariants: {
      padding: "default",
    },
  },
);

export function PlaceholderWatermark({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 -rotate-12",
        "font-code text-[clamp(3rem,11vw,10rem)] leading-none font-black tracking-[0.08em] whitespace-nowrap text-amber-500/20 select-none",
        className,
      )}
    >
      PLACEHOLDER
    </span>
  );
}

/** Shared landing measure and vertical rhythm. */
export function LandingSection({
  children,
  className,
  padding,
  ...props
}: ComponentProps<"section"> &
  VariantProps<typeof landingSectionVariants>): React.JSX.Element {
  return (
    <section
      className={cn(landingSectionVariants({ padding }), "relative", className)}
      {...props}
    >
      <PlaceholderWatermark />
      {children}
    </section>
  );
}
