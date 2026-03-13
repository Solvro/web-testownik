"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2Icon, GraduationCapIcon, MailIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/types/user";
import { ACCOUNT_TYPE } from "@/types/user";

const ACCOUNT_TYPE_BADGE_CONFIG: Record<
  AccountType,
  { color: string; icon: LucideIcon | null; label: string }
> = {
  [ACCOUNT_TYPE.GUEST]: {
    color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: null,
    label: "Gość",
  },
  [ACCOUNT_TYPE.EMAIL]: {
    color: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    icon: MailIcon,
    label: "Email",
  },
  [ACCOUNT_TYPE.STUDENT]: {
    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2Icon,
    label: "Student",
  },
  [ACCOUNT_TYPE.LECTURER]: {
    color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    icon: GraduationCapIcon,
    label: "Wykładowca",
  },
};

interface AccountTypeBadgeProps {
  accountType: AccountType;
  className?: string;
}

export function AccountTypeBadge({
  accountType,
  className,
}: AccountTypeBadgeProps) {
  const {
    icon: Icon,
    color: badgeColor,
    label,
  } = ACCOUNT_TYPE_BADGE_CONFIG[accountType];

  return (
    <Badge className={cn(badgeColor, className)}>
      {Icon != null && <Icon />}
      {label}
    </Badge>
  );
}
