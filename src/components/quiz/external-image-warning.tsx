"use client";

import {
  ImageOffIcon,
  MaximizeIcon,
  MinimizeIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExternalImageWarningProps {
  domains: string[];
  onApprove: () => void;
}

export function ExternalImageWarning({
  domains,
  onApprove,
}: ExternalImageWarningProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (collapsed) {
    return (
      <div className="flex">
        <Button
          variant="outline"
          size="sm"
          className="min-w-0 shrink border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400"
          onClick={() => {
            setCollapsed(false);
          }}
        >
          <ShieldAlertIcon className="mr-2 size-4" />
          <span className="truncate">Zewnętrzne zdjęcia są zablokowane</span>
          <MaximizeIcon className="ml-2 size-3 opacity-50" />
        </Button>
      </div>
    );
  }

  return (
    <Alert
      className={cn(
        "overflow-hidden border-amber-500/50 bg-amber-500/5 text-amber-600 dark:text-amber-400",
      )}
    >
      <ShieldAlertIcon className="size-4" />
      <AlertTitle className="flex items-center justify-between">
        <span className="font-semibold">Zewnętrzne zdjęcia są zablokowane</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-amber-600/70 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400/70 dark:hover:text-amber-400"
          onClick={() => {
            setCollapsed(true);
          }}
        >
          <MinimizeIcon className="size-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="min-w-0 gap-3 overflow-hidden">
        <p>
          Ten quiz zawiera zdjęcia z zewnętrznych serwerów. Ze względów
          bezpieczeństwa nie są one automatycznie ładowane.
        </p>

        <div className="flex w-full flex-col gap-1 overflow-hidden">
          <p className="text-xs font-medium">Wykryte domeny:</p>
          <div className="flex flex-wrap gap-2 overflow-auto">
            {domains.map((domain) => (
              <Badge key={domain} variant="secondary">
                <span className="truncate">{domain}</span>
              </Badge>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          onClick={onApprove}
          className="mt-2 max-w-full min-w-0 shrink bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
        >
          <ImageOffIcon />
          <span className="truncate">Załaduj zdjęcia</span>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
