import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { monoLabelVariants } from "./typography-variants";

export function MonoLabel({
  className,
  size,
  tone,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof monoLabelVariants>): React.JSX.Element {
  return (
    <span
      className={cn(monoLabelVariants({ size, tone }), className)}
      {...props}
    />
  );
}

export function Eyebrow({
  className,
  ...props
}: ComponentProps<"span">): React.JSX.Element {
  return <MonoLabel size="md" className={className} {...props} />;
}

export function DisplayHeading({
  children,
  className,
  ...props
}: ComponentProps<"h2">): React.JSX.Element {
  return (
    <h2
      className={cn(
        "font-landing mt-4 text-[clamp(2.7rem,13vw,4.4rem)] leading-[0.9] font-[740] tracking-[-0.068em]",
        "sm:text-[clamp(3rem,6vw,6.7rem)]",
        "[&_em]:text-primary [&_em]:not-italic",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}
