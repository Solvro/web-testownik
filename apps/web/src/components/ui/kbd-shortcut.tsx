"use client";

import { Kbd } from "@/components/ui/kbd";
import { useIsApplePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface KbdShortcutProps {
  macKey?: string;
  winKey?: string;
  suffix: string;
  className?: string;
}

function KbdShortcut({
  macKey = "⌘",
  winKey = "Ctrl",
  suffix,
  className,
}: KbdShortcutProps) {
  const isMac = useIsApplePlatform();

  const modifierKey = isMac ? macKey : winKey;

  return (
    <Kbd className={cn(className)}>
      {modifierKey} {suffix}
    </Kbd>
  );
}

export { KbdShortcut };
