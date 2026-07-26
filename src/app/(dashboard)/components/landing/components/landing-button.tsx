import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "./focus";

/**
 * The landing's own button look: uppercase, tight tracking, brand fill. It is
 * deliberately not the app's `Button` — this page has a different type scale
 * and sits on top of the WebGL scene rather than inside the app shell.
 */
const landingButtonVariants = cva(
  `inline-flex items-center justify-center gap-2.5 rounded-[0.65rem] text-xs font-[760] tracking-[0.04em] uppercase transition-colors [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS_RING}`,
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        onDark:
          "border border-white/[0.18] font-bold text-inherit hover:bg-white/10",
      },
      size: {
        default: "min-h-11 px-[1.1rem]",
        large: "min-h-13 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type LandingButtonVariants = VariantProps<typeof landingButtonVariants>;

export function LandingButton({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & LandingButtonVariants): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(landingButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export function LandingButtonLink({
  children,
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & LandingButtonVariants): React.JSX.Element {
  return (
    <Link
      className={cn(landingButtonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
