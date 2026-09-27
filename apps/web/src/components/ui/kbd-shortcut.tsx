"use client";

import { useEffect, useState } from "react";

import { Kbd } from "@/components/ui/kbd";
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
  const [isMac, setIsMac] = useState<boolean | null>(null);

  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
    setIsMac(platform.includes("mac") || userAgent.includes("mac"));
  }, []);

  if (isMac === null) {
    return null;
  }

  const modifierKey = isMac ? macKey : winKey;

  return (
    <Kbd className={cn(className)}>
      {modifierKey} {suffix}
    </Kbd>
  );
}

export { KbdShortcut };
