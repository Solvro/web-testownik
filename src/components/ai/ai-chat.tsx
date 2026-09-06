"use client";

import {
  BotMessageSquareIcon,
  BrushCleaningIcon,
  Clock3Icon,
  MaximizeIcon,
  MinimizeIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";

import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
import { ChatRuntime } from "@/components/ai/chat-runtime";
import { ChatThread } from "@/components/ai/chat-thread";
import type { ChatNotice } from "@/components/ai/chat-thread";
import { ModelSelect } from "@/components/ai/model-select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAIModels } from "@/hooks/use-ai-models";
import { useAIUsage } from "@/hooks/use-ai-usage";
import { useQuotaResetTimer } from "@/hooks/use-quota-reset-timer";
import { useUserSettings } from "@/hooks/use-user-settings";
import {
  getAiModelMetadata,
  getAiModelOptions,
  resolvePreferredAiModel,
} from "@/lib/ai/models";
import type { AIAvailableModel } from "@/lib/ai/models";
import type { QuotaExceededBody } from "@/lib/ai/quota";
import {
  formatAICompactCredits,
  formatAIResetAt,
  isAIUsageUnlimited,
  isAIUsageWindowUnlimited,
  usageWindowPercent,
} from "@/lib/ai/usage";
import { cn } from "@/lib/utils";
import type { AIUsageSummary } from "@/types/ai-usage";
import type { Question } from "@/types/quiz";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

type ChatMode = "popup" | "sheet";
const EMPTY_AI_MODELS: AIAvailableModel[] = [];

function ChatUsageRing({
  value,
  indicatorClassName,
  label,
  className,
  ...props
}: {
  value: number;
  indicatorClassName: string;
  label: string;
} & Omit<ComponentProps<"button">, "children" | "value">) {
  return (
    <button
      {...props}
      type="button"
      className={cn(
        "hover:bg-accent focus-visible:ring-ring/50 -my-1 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 sm:size-8",
        className,
      )}
      aria-label={label}
    >
      <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="7.5"
          pathLength="100"
          fill="none"
          strokeWidth="2.5"
          className="stroke-muted"
        />
        <circle
          cx="10"
          cy="10"
          r="7.5"
          pathLength="100"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, Math.min(value, 100)).toString()} 100`}
          className={cn("transition-[stroke-dasharray]", indicatorClassName)}
        />
      </svg>
    </button>
  );
}

function ChatUsageIndicator({
  usage,
  isError,
}: {
  usage: AIUsageSummary | undefined;
  isError: boolean;
}) {
  if (isError) {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <ChatUsageRing
              value={100}
              indicatorClassName="stroke-destructive/60"
              label="Limit AI niedostępny"
            />
          }
        />
        <PopoverContent align="start" className="w-64">
          <PopoverHeader>
            <PopoverTitle>Limit AI niedostępny</PopoverTitle>
            <PopoverDescription>
              Nie udało się pobrać wykorzystania limitu AI.
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    );
  }
  if (usage === undefined) {
    return (
      <span
        className="-my-1 flex size-8 shrink-0 animate-pulse items-center justify-center"
        aria-label="Ładowanie wykorzystania limitu AI"
        role="status"
      >
        <span className="border-muted border-2.5 size-5 rounded-full" />
      </span>
    );
  }

  if (isAIUsageUnlimited(usage)) {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <ChatUsageRing
              value={100}
              indicatorClassName="stroke-primary/65"
              label="Korzystanie z AI bez limitu"
            />
          }
        />
        <PopoverContent align="start" className="w-64">
          <PopoverHeader>
            <PopoverTitle>Bez limitu</PopoverTitle>
            <PopoverDescription>
              Możesz korzystać z AI bez ograniczenia kredytów.
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    );
  }

  const percent = Math.max(
    usageWindowPercent(usage.session),
    usageWindowPercent(usage.weekly),
  );
  const roundedPercent = Math.round(percent);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <ChatUsageRing
            value={roundedPercent}
            indicatorClassName={
              roundedPercent >= 80 ? "stroke-amber-500" : "stroke-primary"
            }
            label={`${roundedPercent.toString()}% limitu AI wykorzystane`}
          />
        }
      />
      <PopoverContent align="start" className="w-72 gap-4">
        <PopoverHeader>
          <PopoverTitle>Twój limit AI</PopoverTitle>
        </PopoverHeader>
        {(
          [
            ["5 godzin", usage.session],
            ["7 dni", usage.weekly],
          ] as const
        )
          .filter(([, window]) => !isAIUsageWindowUnlimited(window))
          .map(([label, window]) => (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between gap-3 text-xs">
                <span>{label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatAICompactCredits(window.used)} /{" "}
                  {formatAICompactCredits(window.limit ?? 0)}
                </span>
              </div>
              <Progress value={usageWindowPercent(window)} />
              {formatAIResetAt(window.resets_at, "short", Date.now()) ===
              null ? null : (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Clock3Icon className="size-3" />
                  Reset {formatAIResetAt(window.resets_at, "short", Date.now())}
                </p>
              )}
            </div>
          ))}
      </PopoverContent>
    </Popover>
  );
}

interface AiChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  quiz: { title: string; description: string };
  question: Question | null;
  questions: Question[];
  userName?: string;
  canEdit?: boolean;
}

export function AiChat({
  open,
  onOpenChange,
  quizId,
  quiz,
  question,
  questions,
  userName,
  canEdit = false,
}: AiChatProps) {
  const {
    data: aiUsage,
    isError: aiUsageIsError,
    refetch: refetchAiUsage,
  } = useAIUsage(open);
  const { data: aiModels, isError: aiModelsIsError } = useAIModels(open);
  const [mode, setMode] = useState<ChatMode>("popup");
  const [chatKey, setChatKey] = useState(0);
  const [quotaBlock, setQuotaBlock] = useState<QuotaExceededBody | null>(null);
  const [fallbackResetAt, setFallbackResetAt] = useState<string | null>(null);
  const [completedFallbackResetAt, setCompletedFallbackResetAt] = useState<
    string | null
  >(null);
  const [servedModel, setServedModel] = useState<{
    model: string;
    requested: string | null;
    quotaTier: string | null;
  } | null>(null);
  const handleQuotaExceeded = useCallback(
    (body: QuotaExceededBody) => {
      setCompletedFallbackResetAt(null);
      setQuotaBlock(body);
      setFallbackResetAt(body.resets_at);
      void refetchAiUsage();
    },
    [refetchAiUsage],
  );
  const { data: settings = DEFAULT_USER_SETTINGS } = useUserSettings({
    placeholderData: DEFAULT_USER_SETTINGS,
  });
  const availableModels = aiModels?.models ?? EMPTY_AI_MODELS;
  const aiModelOptions = useMemo(
    () => getAiModelOptions(availableModels),
    [availableModels],
  );
  const canSelectAiModel = aiModelOptions.length > 1;
  const limitsEnabled = aiUsage?.limits_enabled !== false;
  const normalQuotaExhausted = limitsEnabled && aiUsage?.exhausted === true;
  const fallbackAiModel =
    normalQuotaExhausted &&
    aiUsage.fallback_model !== null &&
    aiUsage.fallback_model === aiModels?.fallback_model?.model
      ? aiUsage.fallback_model
      : null;
  const defaultAiModel = resolvePreferredAiModel(
    settings.default_ai_model,
    availableModels,
    aiModels?.default_model ?? null,
  );
  const [manualAiModel, setManualAiModel] = useState<string | null>(null);
  const selectedAiModel =
    fallbackAiModel ??
    (manualAiModel !== null &&
    availableModels.some((model) => model.model === manualAiModel)
      ? manualAiModel
      : defaultAiModel);
  const summaryFallbackResetAt = aiUsage?.fallback_resets_at ?? null;
  const responseResetAt = limitsEnabled
    ? (quotaBlock?.resets_at ??
      fallbackResetAt ??
      (summaryFallbackResetAt === completedFallbackResetAt
        ? null
        : summaryFallbackResetAt) ??
      null)
    : null;
  const handleQuotaReset = useCallback(
    (completedResetAt: string) => {
      setCompletedFallbackResetAt(completedResetAt);
      setQuotaBlock(null);
      setFallbackResetAt(null);
      void refetchAiUsage();
    },
    [refetchAiUsage],
  );
  const quotaClock = useQuotaResetTimer(responseResetAt, handleQuotaReset);
  const responseBlockActive =
    responseResetAt !== null &&
    new Date(responseResetAt).getTime() > quotaClock;
  const quotaResetAt = responseBlockActive
    ? responseResetAt
    : limitsEnabled
      ? (aiUsage?.blocked_until ?? null)
      : null;
  const modelSelectorOptions = useMemo(() => {
    const options = aiModelOptions.map((model) => ({
      id: model.value,
      name: model.label,
      icon: <AiModelProviderIcon provider={model.provider} />,
    }));
    if (
      fallbackAiModel !== null &&
      !options.some((model) => model.id === fallbackAiModel)
    ) {
      const metadata = getAiModelMetadata(
        aiModels?.fallback_model === null ||
          aiModels?.fallback_model === undefined
          ? []
          : [aiModels.fallback_model],
        fallbackAiModel,
      );
      if (metadata !== null) {
        options.push({
          id: fallbackAiModel,
          name: metadata.label,
          icon: <AiModelProviderIcon provider={metadata.provider} />,
        });
      }
    }
    return options;
  }, [aiModelOptions, aiModels?.fallback_model, fallbackAiModel]);
  const modelAvailabilityPending = aiModels === undefined && !aiModelsIsError;
  const modelUnavailable = aiModels !== undefined && selectedAiModel === null;
  const handleModelResolved = useCallback(
    (
      model: string,
      quotaTier: string | null,
      nextFallbackResetAt: string | null,
    ) => {
      setCompletedFallbackResetAt(null);
      setQuotaBlock(null);
      setFallbackResetAt(quotaTier === "fallback" ? nextFallbackResetAt : null);
      setServedModel({ model, requested: selectedAiModel, quotaTier });
    },
    [selectedAiModel],
  );
  const quotaResetLabel = formatAIResetAt(quotaResetAt, "short", quotaClock);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  let quotaNotice: ChatNotice | null = null;
  if (
    servedModel !== null &&
    servedModel.quotaTier !== "fallback" &&
    servedModel.requested === selectedAiModel &&
    servedModel.model !== selectedAiModel
  ) {
    quotaNotice = {
      kind: "warning",
      message: `Wybrany model był niedostępny · użyto ${servedModel.model}`,
    };
  }

  return (
    <aside
      aria-labelledby="ai-chat-title"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "bg-background fixed z-50 flex flex-col overflow-hidden transition-all",
        !open && "pointer-events-none scale-95 opacity-0",
        open && "scale-100 opacity-100",
        mode === "popup" && [
          "right-4 bottom-4 h-[min(480px,calc(100dvh-2rem))] w-[min(380px,calc(100vw-2rem))] rounded-2xl border shadow-2xl",
        ],
        mode === "sheet" && [
          "right-0 bottom-0 h-dvh w-full border-l shadow-2xl sm:w-105",
        ],
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between border-b px-4 py-2.5",
          mode === "popup" && "rounded-t-2xl",
        )}
      >
        <div className="flex items-center gap-2">
          <BotMessageSquareIcon className="text-primary size-4" />
          <h2
            id="ai-chat-title"
            className="truncate text-sm leading-normal font-semibold"
          >
            Asystent AI
          </h2>
          <ChatUsageIndicator usage={aiUsage} isError={aiUsageIsError} />
        </div>
        <div className="ml-2 flex min-w-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-10 sm:size-8"
            onClick={() => {
              setChatKey((k) => k + 1);
              setQuotaBlock(null);
              setServedModel(null);
            }}
            aria-label="Rozpocznij nowy czat"
          >
            <BrushCleaningIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-10 sm:size-8"
            onClick={() => {
              setMode(mode === "popup" ? "sheet" : "popup");
            }}
            aria-label={mode === "popup" ? "Rozwiń" : "Zwiń"}
          >
            {mode === "popup" ? (
              <MaximizeIcon className="size-3.5" />
            ) : (
              <MinimizeIcon className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-10 sm:size-8"
            onClick={() => {
              onOpenChange(false);
            }}
            aria-label="Zamknij czat"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatRuntime
          key={chatKey}
          quizId={quizId}
          quiz={quiz}
          question={question}
          questions={questions}
          userName={userName}
          canEdit={canEdit}
          selectedModel={selectedAiModel}
          onQuotaExceeded={handleQuotaExceeded}
          onModelResolved={handleModelResolved}
        >
          {(runtime) => (
            <ChatThread
              runtime={runtime}
              userName={userName}
              cooldownLabel={responseBlockActive ? quotaResetLabel : null}
              composerDisabled={
                responseBlockActive ||
                modelUnavailable ||
                modelAvailabilityPending
              }
              composerDisabledMessage={
                modelAvailabilityPending
                  ? "Sprawdzam dostępność modeli AI…"
                  : modelUnavailable
                    ? "Brak dostępnego modelu AI. Spróbuj ponownie później."
                    : quotaResetLabel === null
                      ? "Model zapasowy jest chwilowo niedostępny"
                      : `Model zapasowy będzie dostępny: ${quotaResetLabel}`
              }
              quotaNotice={quotaNotice}
              composerStart={
                (canSelectAiModel || fallbackAiModel !== null) &&
                selectedAiModel !== null ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="inline-flex min-w-0" />}
                      >
                        <ModelSelect
                          models={modelSelectorOptions}
                          value={selectedAiModel}
                          onValueChange={(value) => {
                            if (
                              availableModels.some(
                                (model) => model.model === value,
                              )
                            ) {
                              setManualAiModel(value);
                              setServedModel(null);
                            }
                          }}
                          disabled={fallbackAiModel !== null}
                          size="sm"
                          className="text-foreground max-w-[calc(100vw-7rem)] min-w-0 rounded-full px-2.5 text-xs sm:w-40"
                          contentClassName="min-w-56"
                        />
                      </TooltipTrigger>
                      {fallbackAiModel === null ? null : (
                        <TooltipContent side="top">
                          Model ustawiono automatycznie po wykorzystaniu
                          podstawowego limitu AI.
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
            />
          )}
        </ChatRuntime>
      </div>
    </aside>
  );
}
