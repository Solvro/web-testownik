import { CrownIcon, MedalIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ACCOUNT_LEVEL } from "@/types/user";
import type { AccountLevel } from "@/types/user";

interface AccountLevelBadgeProps {
  accountLevel: AccountLevel;
  className?: string;
}

export function AccountLevelBadge({
  accountLevel,
  className,
}: AccountLevelBadgeProps) {
  if (accountLevel === ACCOUNT_LEVEL.BASIC) {
    return null;
  }

  const config =
    accountLevel === ACCOUNT_LEVEL.GOLD
      ? {
          label: "Gold",
          Icon: CrownIcon,
          className:
            "border border-amber-300/50 bg-gradient-to-r from-amber-200/60 via-yellow-200/80 to-amber-300/70 text-amber-900 shadow-[0_4px_14px_-10px_rgba(217,119,6,0.95)] dark:border-amber-300/30 dark:from-amber-300/20 dark:via-yellow-300/25 dark:to-amber-300/15 dark:text-amber-200",
        }
      : {
          label: "Silver",
          Icon: MedalIcon,
          className:
            "border border-slate-300/70 bg-gradient-to-r from-slate-100/80 via-white to-slate-200/80 text-slate-800 shadow-[0_4px_14px_-10px_rgba(100,116,139,0.9)] dark:border-slate-200/30 dark:from-slate-200/20 dark:via-white/20 dark:to-slate-300/15 dark:text-slate-100",
        };
  const { Icon } = config;

  return (
    <Badge className={cn(config.className, className)}>
      <Icon />
      {config.label}
    </Badge>
  );
}
