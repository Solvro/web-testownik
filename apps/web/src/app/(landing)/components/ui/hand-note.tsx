import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { handwritingClassName } from "./handwriting";

export function HandNote({
  className,
  ...props
}: ComponentProps<"p">): React.JSX.Element {
  return (
    <p
      className={cn(handwritingClassName, "lp-hand-note", className)}
      {...props}
    />
  );
}

export function MarginSketch(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="lp-margin-sketch"
      viewBox="0 0 150 65"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 36h125m-5-4 5 4-6 3M27 59V7m-4 6 4-6 3 6M13 44c14-43 27-43 42-8s27 34 42 0 25-31 36-11" />
      <path d="m105 7 8 9m0-10-9 11" opacity=".5" />
    </svg>
  );
}
