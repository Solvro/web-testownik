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
