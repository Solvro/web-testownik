import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { demoPanelVariants } from "./demo-panel-variants";

export function DemoPanel({
  className,
  ...props
}: ComponentProps<"div">): React.JSX.Element {
  return <div className={cn(demoPanelVariants(), className)} {...props} />;
}

export function DemoHeader({
  className,
  ...props
}: ComponentProps<"header">): React.JSX.Element {
  return (
    <header
      className={cn(
        "border-border flex items-center justify-between gap-4 border-b pb-[1.2rem]",
        className,
      )}
      {...props}
    />
  );
}
