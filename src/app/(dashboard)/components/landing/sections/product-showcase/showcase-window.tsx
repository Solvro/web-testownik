import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { MonoLabel } from "../../components/typography";

interface ShowcaseWindowProps extends ComponentProps<"div"> {
  path: string;
}

/** Browser frame shared by every interactive showcase scene. */
export function ShowcaseWindow({
  children,
  className,
  path,
  ...props
}: ShowcaseWindowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "border-border bg-background m-2 min-h-[32rem] w-[calc(100%-1rem)] self-center overflow-hidden rounded-[0.85rem] border shadow-[0_2.4rem_5rem_color-mix(in_oklch,var(--foreground)_12%,transparent)]",
        "sm:m-7 sm:min-h-[42rem] sm:w-[calc(100%-3.5rem)]",
        className,
      )}
      {...props}
    >
      <div className="border-border bg-card flex h-10 items-center gap-[0.42rem] border-b px-4 sm:h-12">
        <span className="bg-muted-foreground size-[0.52rem] rounded-full opacity-[0.38]" />
        <span className="bg-muted-foreground size-[0.52rem] rounded-full opacity-[0.38]" />
        <span className="bg-muted-foreground size-[0.52rem] rounded-full opacity-[0.38]" />
        <MonoLabel
          size="xs"
          className="ml-[0.4rem] truncate font-semibold normal-case"
        >
          testownik.solvro.pl / {path}
        </MonoLabel>
      </div>
      {children}
    </div>
  );
}
