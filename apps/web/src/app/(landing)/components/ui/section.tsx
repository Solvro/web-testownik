import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const landingSectionVariants = cva(
  "mx-auto w-[calc(100%-2rem)] sm:w-[min(100%-3rem,96rem)]",
  {
    variants: {
      padding: {
        default: "py-12 sm:py-20",
        showcase: "pt-12 pb-12 sm:pb-20",
      },
    },
    defaultVariants: {
      padding: "default",
    },
  },
);

/**
 * Shared landing measure and vertical rhythm. Like every landing section it is
 * an in-page link target, so it takes focus programmatically (no ring).
 */
export function LandingSection({
  children,
  className,
  padding,
  ...props
}: ComponentProps<"section"> &
  VariantProps<typeof landingSectionVariants>): React.JSX.Element {
  return (
    <section
      tabIndex={-1}
      className={cn(
        landingSectionVariants({ padding }),
        "relative outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
