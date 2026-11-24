"use client";

import { XIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NoticeDismissButtonProps {
  label: string;
  isDisabled?: boolean;
  onDismiss: () => void;
}

interface CompactNoticeProps {
  icon: LucideIcon;
  dismissLabel: string;
  onDismiss: () => void;
  children: React.ReactNode;
}

/** The X of a notice, explaining in a tooltip what closing it does. */
export function NoticeDismissButton({
  label,
  isDisabled = false,
  onDismiss,
}: NoticeDismissButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={isDisabled}
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <XIcon />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A slim dismissible banner above the page, short enough to leave room on phones. */
export function CompactNotice({
  icon: Icon,
  dismissLabel,
  onDismiss,
  children,
}: CompactNoticeProps): React.JSX.Element {
  return (
    <div
      role="status"
      data-slot="compact-notice"
      className="bg-card text-muted-foreground flex items-center gap-2.5 rounded-lg border py-1 pr-1 pl-3 text-xs leading-snug sm:text-sm"
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <p className="[&_a]:hover:text-foreground min-w-0 flex-1 py-1 text-pretty [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </p>
      <NoticeDismissButton label={dismissLabel} onDismiss={onDismiss} />
    </div>
  );
}
