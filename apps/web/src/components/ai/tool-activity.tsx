"use client";

import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ToolActivityStatus = "pending" | "running" | "complete" | "error";

const statusConfig = {
  pending: {
    icon: CircleIcon,
    className: "text-muted-foreground",
  },
  running: {
    icon: LoaderCircleIcon,
    className: "text-primary",
  },
  complete: {
    icon: CheckIcon,
    className: "text-emerald-700 dark:text-emerald-400",
  },
  error: {
    icon: AlertCircleIcon,
    className: "text-destructive",
  },
} satisfies Record<
  ToolActivityStatus,
  { icon: typeof CircleIcon; className: string }
>;

export function ToolActivity({
  title,
  status,
  defaultOpen = false,
  children,
}: {
  title: string;
  status: ToolActivityStatus;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="my-1 w-full">
      <CollapsibleTrigger
        className="text-muted-foreground hover:text-foreground focus-visible:bg-muted/50 focus-visible:text-foreground focus-visible:ring-ring/50 flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset"
        aria-label={`${open ? "Ukryj" : "Pokaż"} szczegóły: ${title}`}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center",
            config.className,
          )}
          aria-hidden="true"
        >
          <StatusIcon
            className={cn("size-4", status === "running" && "animate-spin")}
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm" role="status">
          {title}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted>
        <div className="border-border ml-2.5 space-y-2 border-l py-1 pl-5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
