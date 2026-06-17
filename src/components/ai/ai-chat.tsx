"use client";

import {
  AssistantRuntimeProvider,
  Suggestions,
  useAui,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import {
  BotMessageSquareIcon,
  BrushCleaningIcon,
  MaximizeIcon,
  MinimizeIcon,
  XIcon,
} from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

import { AppContext } from "@/app-context";
import { AiChatProvider } from "@/components/ai/ai-chat-context";
import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
import { DisableAiToolUI } from "@/components/ai/tool-ui-disable-ai";
import { EditQuestionToolUI } from "@/components/ai/tool-ui-edit-question";
import { GeneratedQuestionsToolUI } from "@/components/ai/tool-ui-question";
import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { Thread } from "@/components/assistant-ui/thread";
import { Button } from "@/components/ui/button";
import { useUserSettings } from "@/hooks/use-user-settings";
import {
  SELECTABLE_AI_MODEL_OPTIONS,
  isSelectableAiModel,
  resolveSelectableAiModel,
} from "@/lib/ai/models";
import type { SelectableAiModel } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/quiz";
import { ACCOUNT_LEVEL, DEFAULT_USER_SETTINGS } from "@/types/user";

type ChatMode = "popup" | "sheet";

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

function ChatRuntime({
  quizId,
  quiz,
  question,
  questions,
  userName,
  canEdit,
  children,
}: {
  quizId: string;
  quiz: { title: string; description: string };
  question: Question | null;
  questions: Question[];
  userName?: string;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const routeContext = useMemo(
    () => ({
      quiz,
      question,
      questions,
      userName,
    }),
    [quiz, question, questions, userName],
  );

  const routeContextRef = useRef(routeContext);
  useEffect(() => {
    routeContextRef.current = routeContext;
  }, [routeContext]);
  const lastSubmittedQuestionRef = useRef<{
    id: string;
    order: number;
  } | null>(null);

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/ai/chat",
        body: () => {
          const currentQuestion = routeContextRef.current.question;
          const previousQuestion = lastSubmittedQuestionRef.current;
          lastSubmittedQuestionRef.current =
            currentQuestion === null
              ? null
              : { id: currentQuestion.id, order: currentQuestion.order };

          return {
            ...routeContextRef.current,
            canEdit,
            questionContextChange:
              previousQuestion !== null &&
              currentQuestion !== null &&
              previousQuestion.id !== currentQuestion.id
                ? { previousQuestionOrder: previousQuestion.order }
                : undefined,
          };
        },
      }),
    [canEdit],
  );

  const suggestions = useMemo(() => {
    const prompts = [
      "Wyjaśnij to pytanie",
      "Podaj wskazówkę do odpowiedzi",
      "Znajdź podobne pytania w tym quizie",
      ...(canEdit
        ? [
            "Popraw literówki w tym pytaniu",
            "Wygeneruj 5 podobnych pytań",
            "Dodaj wyjaśnienie odpowiedzi",
            "Popraw formatowanie tego pytania",
            "Uprość te pytanie",
          ]
        : []),
    ] as const;
    const count = Math.min(prompts.length, Math.random() < 0.5 ? 2 : 3);
    return prompts
      .map((prompt) => ({ prompt, order: Math.random() }))
      .toSorted((a, b) => a.order - b.order)
      .slice(0, count)
      .map(({ prompt }) => prompt);
  }, [canEdit]);

  const runtime = useChatRuntime({ transport });
  const aui = useAui({
    suggestions: Suggestions(suggestions),
  });

  const chatContext = useMemo(
    () => ({ quizId, questionId: question?.id ?? null, question, canEdit }),
    [quizId, question, canEdit],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime} aui={aui}>
      <AiChatProvider value={chatContext}>
        <GeneratedQuestionsToolUI />
        <EditQuestionToolUI />
        <DisableAiToolUI />
        {children}
      </AiChatProvider>
    </AssistantRuntimeProvider>
  );
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
  const { user } = useContext(AppContext);
  const [mode, setMode] = useState<ChatMode>("popup");
  const [chatKey, setChatKey] = useState(0);
  const { data: settings = DEFAULT_USER_SETTINGS } = useUserSettings({
    placeholderData: DEFAULT_USER_SETTINGS,
  });
  const canSelectAiModel = user?.account_level === ACCOUNT_LEVEL.GOLD;
  const defaultAiModel = resolveSelectableAiModel(settings.default_ai_model);
  const [manualAiModel, setManualAiModel] = useState<SelectableAiModel | null>(
    null,
  );
  const selectedAiModel = manualAiModel ?? defaultAiModel;
  const modelSelectorOptions = useMemo(
    () =>
      SELECTABLE_AI_MODEL_OPTIONS.map((model) => ({
        id: model.value,
        name: model.label,
        icon: <AiModelProviderIcon provider={model.provider} />,
      })),
    [],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event_: KeyboardEvent) => {
      if (event_.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <>
      {open && mode === "sheet" ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs sm:hidden"
          onClick={() => {
            onOpenChange(false);
          }}
          aria-label="Zamknij panel"
        />
      ) : null}

      <div
        className={cn(
          "bg-background fixed z-50 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
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
            <span className="truncate text-sm font-semibold">Asystent AI</span>
          </div>
          <div className="ml-2 flex min-w-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setChatKey((k) => k + 1);
              }}
              aria-label="Wyczyść czat"
            >
              <BrushCleaningIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
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
          >
            <Thread
              composerStart={
                canSelectAiModel ? (
                  <ModelSelector
                    models={modelSelectorOptions}
                    value={selectedAiModel}
                    onValueChange={(value) => {
                      if (isSelectableAiModel(value)) {
                        setManualAiModel(value);
                      }
                    }}
                    size="sm"
                    className="max-w-[calc(100vw-7rem)] min-w-0 rounded-full px-2.5 text-xs sm:w-40"
                    contentClassName="min-w-56"
                  />
                ) : null
              }
            />
          </ChatRuntime>
        </div>
      </div>
    </>
  );
}
