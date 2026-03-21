import { CrownIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AccountLevelBadgeProps {
  accountLevel: "basic" | "gold";
  className?: string;
}

export function AccountLevelBadge({
  accountLevel,
  className,
}: AccountLevelBadgeProps) {
  if (accountLevel !== "gold") {
    return null;
  }

  return (
    <Badge
      className={cn(
        "border border-amber-300/50 bg-gradient-to-r from-amber-200/60 via-yellow-200/80 to-amber-300/70 text-amber-900 shadow-[0_4px_14px_-10px_rgba(217,119,6,0.95)] dark:border-amber-300/30 dark:from-amber-300/20 dark:via-yellow-300/25 dark:to-amber-300/15 dark:text-amber-200",
        className,
      )}
    >
      <CrownIcon />
      Gold
    </Badge>
  );
}
