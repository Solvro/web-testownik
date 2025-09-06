import React from "react";

import { cn } from "@/lib/utils.ts";

export function AppLogo({
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  className?: string;
}) {
  return (
    <img
      src="/solvro_mono.svg"
      alt="logo solvro"
      width={40}
      className={cn("invert dark:invert-0", className)}
      {...props}
    />
  );
}
