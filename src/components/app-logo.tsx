import Image from "next/image";

import { cn } from "@/lib/utils";

interface AppLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function AppLogo({
  width = 40,
  height,
  className,
}: AppLogoProps): React.JSX.Element {
  return (
    <Image
      src="/solvro_mono.svg"
      alt="Logo"
      width={width}
      height={height ?? width * 0.8}
      className={cn("invert dark:invert-0", className)}
      unoptimized
    />
  );
}
