"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-base font-normal transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border dark:border-0 bg-input hover:bg-accent-input dark:hover:bg-ring",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-border has-[>svg]:dark:border-input bg-input shadow-xs hover:bg-accent-input hover:text-accent-foreground dark:bg-background dark:border-input dark:hover:bg-input",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent-input hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        cta: "bg-linear-to-r from-(--cta-gradient-from) to-(--cta-gradient-to) text-primary-foreground",
        loading: "",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10 px-4 py-2 has-[>svg]:p-2 [&_svg:not([class*='size-'])]:size-6",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  if (variant === "loading") {
    return (
      <div
        className={cn(
          buttonVariants({ variant, size, className }),
          "relative -left-1 -my-1 inline-flex h-10 overflow-hidden rounded-md border-none p-1",
        )}
      >
        <span className="absolute -inset-full animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--card)_40%,var(--border)_45%,var(--border)_55%,var(--card)_60%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,var(--card)_40%,var(--ring)_45%,var(--ring)_55%,var(--card)_60%)]" />
        <span className="bg-accent-input dark:bg-ring inline-flex h-full w-full items-center justify-center rounded-md border px-3 text-base font-medium backdrop-blur-3xl dark:border-none">
          Otwórz
        </span>
      </div>
    );
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      render={render}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
