"use client";

import {
  BotMessageSquareIcon,
  BrushCleaningIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
} from "lucide-react";

import { PREVIEW_QUIZ } from "@/app/(landing)/preview/preview-fixtures";
import {
  PreviewRuntime,
  PreviewSandbox,
} from "@/app/(landing)/preview/preview-provider";
import type { PreviewQuizSession } from "@/app/(landing)/preview/preview-session";
import type { ChatRuntimeValue } from "@/components/ai/chat-runtime";
import { ChatThread } from "@/components/ai/chat-thread";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { describeFailure } from "./showcase-chat";
import type { Failure } from "./showcase-chat";
import { useShowcaseSession } from "./showcase-session-context";

/** The current question, which the assistant sees, and a way to switch it. */
function ActiveQuestion({
  session,
}: {
  session: PreviewQuizSession;
}): React.JSX.Element | null {
  const { question } = session.view;
  const { questions } = session.state;
  if (question === null) {
    return null;
  }
  const index = questions.findIndex(({ id }) => id === question.id);
  const goTo = (offset: -1 | 1): void => {
    const target =
      questions[
        (Math.max(index, 0) + offset + questions.length) % questions.length
      ];
    session.goTo(target.id);
  };

  return (
    <div className="border-border bg-card flex items-start gap-2 border-b px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <CircleHelpIcon aria-hidden="true" className="size-3.5" />
          <span className="tabular-nums" aria-live="polite">
            Aktywne pytanie · {Math.max(index + 1, 1)} z {questions.length}
          </span>
        </div>
        <MarkdownRenderer className="mt-1 line-clamp-2 text-sm leading-snug font-semibold">
          {question.text}
        </MarkdownRenderer>
      </div>
      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Pokaż poprzednie pytanie"
          disabled={questions.length < 2}
          onClick={() => {
            goTo(-1);
          }}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Pokaż następne pytanie"
          disabled={questions.length < 2}
          onClick={() => {
            goTo(1);
          }}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

function DemoChat({
  runtime,
  session,
  failure,
  onNewConversation,
}: {
  runtime: ChatRuntimeValue;
  session: PreviewQuizSession;
  failure: Failure | null;
  onNewConversation: () => void;
}): React.JSX.Element {
  const { messages, error, status } = runtime;
  const running = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <span className="bg-primary/10 grid size-9 shrink-0 place-items-center rounded-full">
          <BotMessageSquareIcon
            aria-hidden="true"
            className="text-landing-primary size-4.5"
          />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm">Asystent AI</strong>
          <span className="text-muted-foreground block truncate text-xs">
            {PREVIEW_QUIZ.title}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Nowa rozmowa"
                disabled={messages.length === 0 || running}
                onClick={onNewConversation}
              >
                <BrushCleaningIcon />
              </Button>
            }
          />
          <TooltipContent>Nowa rozmowa</TooltipContent>
        </Tooltip>
      </header>
      <ActiveQuestion session={session} />
      <div className="min-h-0 flex-1">
        <ChatThread
          runtime={runtime}
          errorMessage={error === undefined ? null : describeFailure(failure)}
        />
      </div>
    </div>
  );
}

/**
 * The app's assistant (`ChatRuntime` + `ChatThread`, tools and tool cards
 * included) on the showcase's quiz session, through the public demo
 * endpoint. It sees the question open in the quiz demo and the whole quiz;
 * generated questions it saves and edits it applies go through the session's
 * preview services into that quiz.
 */
export function AiDemo(): React.JSX.Element {
  const {
    quiz: session,
    chatRuntime: runtime,
    chatFailure: failure,
    newConversation,
  } = useShowcaseSession();

  return (
    <PreviewSandbox className="rounded-[1rem]">
      <PreviewRuntime client={session.client}>
        <div className="bg-background text-foreground flex h-[38rem] flex-col overflow-hidden rounded-[1rem] border shadow-xl shadow-black/5 sm:h-[40rem] lg:h-full">
          <DemoChat
            runtime={runtime}
            session={session}
            failure={failure}
            onNewConversation={newConversation}
          />
        </div>
      </PreviewRuntime>
    </PreviewSandbox>
  );
}
