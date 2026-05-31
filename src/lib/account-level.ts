import type { AccountLevel } from "@/types/user";
import { ACCOUNT_LEVEL } from "@/types/user";

export function getAccountLevelAvatarClassName(
  accountLevel?: AccountLevel | null,
) {
  switch (accountLevel) {
    case ACCOUNT_LEVEL.GOLD: {
      return "ring-offset-background shadow-[0_0_20px_-8px_rgba(245,158,11,0.9)] ring-2 ring-amber-400/85 ring-offset-1";
    }
    case ACCOUNT_LEVEL.SILVER: {
      return "ring-offset-background shadow-[0_0_18px_-8px_rgba(148,163,184,0.9)] ring-2 ring-slate-300/90 ring-offset-1 dark:ring-slate-200/80";
    }
    case ACCOUNT_LEVEL.BASIC:
    case null:
    case undefined: {
      return null;
    }
  }
}

export function getAccountLevelProfileAvatarClassName(
  accountLevel?: AccountLevel | null,
) {
  switch (accountLevel) {
    case ACCOUNT_LEVEL.GOLD: {
      return "ring-offset-background shadow-[0_0_24px_-8px_rgba(245,158,11,0.95)] ring-4 ring-amber-400/85 ring-offset-2";
    }
    case ACCOUNT_LEVEL.SILVER: {
      return "ring-offset-background shadow-[0_0_22px_-8px_rgba(148,163,184,0.95)] ring-4 ring-slate-300/90 ring-offset-2 dark:ring-slate-200/80";
    }
    case ACCOUNT_LEVEL.BASIC:
    case null:
    case undefined: {
      return null;
    }
  }
}

export function getAccountLevelCtaClassName(
  accountLevel?: AccountLevel | null,
) {
  switch (accountLevel) {
    case ACCOUNT_LEVEL.GOLD: {
      return "border border-amber-300/70 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-950 shadow-[0_8px_22px_-14px_rgba(217,119,6,0.95)] transition-all hover:from-amber-300 hover:via-yellow-200 hover:to-amber-300";
    }
    case ACCOUNT_LEVEL.SILVER: {
      return "border border-slate-300/80 bg-gradient-to-r from-slate-100 via-white to-slate-200 text-slate-900 shadow-[0_8px_22px_-14px_rgba(100,116,139,0.9)] transition-all hover:from-white hover:via-slate-50 hover:to-slate-100 dark:from-slate-300 dark:via-slate-100 dark:to-slate-300";
    }
    case ACCOUNT_LEVEL.BASIC:
    case null:
    case undefined: {
      return null;
    }
  }
}
