import Image from "next/image";

import { cn } from "@/lib/utils";

interface SolvroLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

const SOLVRO_LOGO_ASPECT_RATIO = 109.695 / 140.014_01;

export function SolvroLogo({
  width = 40,
  height,
  className,
}: SolvroLogoProps): React.JSX.Element {
  return (
    <Image
      src="/solvro_mono.svg"
      alt="Logo"
      width={width}
      height={height ?? width * SOLVRO_LOGO_ASPECT_RATIO}
      className={cn("h-auto invert dark:invert-0", className)}
    />
  );
}
