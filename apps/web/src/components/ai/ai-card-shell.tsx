"use client";

import {
  AlertCircleIcon,
  Clock3Icon,
  LifeBuoyIcon,
  RefreshCwIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAIModels } from "@/hooks/use-ai-models";
import { getAiModelMetadata } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export function LoadingDots() {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-muted-foreground text-xs">Myślę</span>
      <span className="flex gap-1">
        <span className="bg-primary/50 size-1.5 animate-pulse rounded-full" />
        <span className="bg-primary/50 size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
        <span className="bg-primary/50 size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
      </span>
    </div>
  );
}

export function AiCardShell({
  title,
  isLoading,
  error,
  errorMessage,
  retryAfter,
  onRetry,
  onStop,
  onClose,
  children,
  emphasized = false,
  retryDisabled = false,
  cooldown = false,
  model,
  fallback,
}: {
  title: string;
  isLoading: boolean;
  error: Error | undefined;
  errorMessage: string | undefined;
  retryAfter: number | null;
  retryDisabled?: boolean;
  cooldown?: boolean;
  model: string | null;
  fallback: boolean;
  onRetry: () => void;
  onStop: () => void;
  onClose: () => void;
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  const retryBlocked = retryDisabled || (retryAfter !== null && retryAfter > 0);
  const { data: aiModels } = useAIModels();
  const modelMetadata =
    model === null
      ? null
      : getAiModelMetadata(
          [
            ...(aiModels?.models ?? []),
            ...(aiModels?.fallback_model === null ||
            aiModels?.fallback_model === undefined
              ? []
              : [aiModels.fallback_model]),
          ],
          model,
        );
  return (
    <Card
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
        emphasized &&
          "border-primary/20 from-primary/5 bg-linear-to-br to-transparent",
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="text-foreground flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
            <div className="bg-primary/10 flex size-6 items-center justify-center rounded-full">
              <SparklesIcon
                className={cn(
                  "text-primary size-3.5",
                  isLoading && "animate-pulse",
                )}
              />
            </div>
            <span>{title}</span>
            {model === null ? null : (
              <Badge variant="secondary" className="max-w-44 font-normal">
                {modelMetadata === null ? null : (
                  <AiModelProviderIcon
                    provider={modelMetadata.provider}
                    className="size-3"
                  />
                )}
                <span className="truncate">
                  {modelMetadata?.label ?? model}
                </span>
              </Badge>
            )}
            {model !== null && fallback ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Model zapasowy"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
                    />
                  }
                >
                  <LifeBuoyIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  Model zapasowy używany po wykorzystaniu głównej puli.
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {isLoading ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-10 sm:size-8"
                onClick={onStop}
                aria-label="Zatrzymaj"
              >
                <SquareIcon className="size-3 fill-current" />
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={retryBlocked ? undefined : onRetry}
                      aria-disabled={retryBlocked}
                      aria-label="Wygeneruj ponownie"
                      className="size-10 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 sm:size-8"
                    />
                  }
                >
                  <RefreshCwIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  {retryBlocked ? errorMessage : "Wygeneruj ponownie"}
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-10 sm:size-8"
              onClick={onClose}
              aria-label="Zamknij"
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error === undefined ? null : (
          <div
            role="status"
            className={cn(
              "flex items-center gap-2.5 py-2 text-xs",
              cooldown ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {cooldown ? (
              <Clock3Icon className="size-4 shrink-0" />
            ) : (
              <AlertCircleIcon className="size-4 shrink-0" />
            )}
            <span className="font-medium tabular-nums">{errorMessage}</span>
          </div>
        )}
        {children}
        <AiDisclaimer className="mt-4 border-t pt-2" />
      </CardContent>
    </Card>
  );
}

/** A card's Markdown reply. */
export function AiCardMarkdown({ children }: { children: string }) {
  return (
    <div className="text-foreground text-sm">
      <MarkdownRenderer className="text-foreground prose-strong:text-foreground">
        {children}
      </MarkdownRenderer>
    </div>
  );
}
