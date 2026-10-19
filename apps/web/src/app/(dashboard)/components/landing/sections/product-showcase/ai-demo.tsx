"use client";

import type { Question } from "@testownik/core/quiz/types";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import {
  BotMessageSquareIcon,
  BrushCleaningIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ChatRuntime } from "@/components/ai/chat-runtime";
import type { ChatRuntimeValue } from "@/components/ai/chat-runtime";
import { ChatThread } from "@/components/ai/chat-thread";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { PREVIEW_QUIZ } from "@/components/testownik-preview/preview-fixtures";
import {
  PreviewRuntime,
  PreviewSandbox,
} from "@/components/testownik-preview/preview-provider";
import type { PreviewQuizSession } from "@/components/testownik-preview/preview-session";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getShowcaseExplanation } from "./showcase-quiz";
import { useShowcaseSession } from "./showcase-session-context";

const EXPLAIN_PROMPT = "Wyjaśnij to pytanie";

/** The empty chat's suggestions: what the app's assistant can do here. */
const SUGGESTIONS = [
  EXPLAIN_PROMPT,
  "Wygeneruj 3 podobne pytania",
  "Popraw literówki w tym pytaniu",
  "Pokaż listę pytań w quizie",
] as const;

const UNAVAILABLE_NOTICE =
  "Asystent jest teraz niedostępny. Spróbuj ponownie za chwilę.";

/** Why the last request failed, from its response. */
interface Failure {
  status: number;
  retryAfter: string | null;
}

function formatRetryAfter(header: string | null): string {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "za chwilę";
  }
  if (seconds < 60) {
    return `za ${Math.ceil(seconds).toString()} s`;
  }
  return `za ok. ${Math.ceil(seconds / 60).toString()} min`;
}

function describeFailure(failure: Failure | null): string {
  if (failure?.status === 429) {
    return `To tylko pokaz, więc liczba pytań jest ograniczona. Spróbuj ponownie ${formatRetryAfter(failure.retryAfter)}.`;
  }
  if (failure?.status === 413 || failure?.status === 400) {
    return "Ta rozmowa jest już za długa na pokaz. Zacznij nową rozmowę.";
  }
  return UNAVAILABLE_NOTICE;
}

function lastUserText(messages: UIMessage[]): string | null {
  const message = messages.findLast((candidate) => candidate.role === "user");
  const part = message?.parts.find((candidate) => candidate.type === "text");
  return part?.type === "text" ? part.text.trim() : null;
}

/**
 * Without the live assistant, "explain" still gets an answer: the question's
 * explanation, streamed like a reply.
 */
function explainOffline(
  messages: UIMessage[],
  question: Question | null,
): Response | undefined {
  if (question === null || lastUserText(messages) !== EXPLAIN_PROMPT) {
    return undefined;
  }
  const id = "demo-offline-explanation";
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id });
        writer.write({
          type: "text-delta",
          id,
          delta: getShowcaseExplanation(question),
        });
        writer.write({ type: "text-end", id });
      },
    }),
  });
}

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
  const { saveChatMessages } = useShowcaseSession();
  const running = status === "submitted" || status === "streaming";

  // The conversation outlives the tab: it is handed back when another demo
  // opens and restored when this one does.
  const messagesReference = useRef(messages);
  useEffect(() => {
    messagesReference.current = messages;
  }, [messages]);
  useEffect(
    () => () => {
      saveChatMessages(messagesReference.current);
    },
    [saveChatMessages],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <span className="bg-primary/10 grid size-9 shrink-0 place-items-center rounded-full">
          <BotMessageSquareIcon
            aria-hidden="true"
            className="text-primary size-4.5"
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
  const { quiz: session, chatMessages } = useShowcaseSession();
  const [failure, setFailure] = useState<Failure | null>(null);

  return (
    <PreviewSandbox className="rounded-[1rem]">
      <PreviewRuntime client={session.client}>
        <div className="bg-background text-foreground flex h-[38rem] flex-col overflow-hidden rounded-[1rem] border shadow-xl shadow-black/5 sm:h-[40rem] lg:h-full">
          <ChatRuntime
            demo
            quizId={PREVIEW_QUIZ.id}
            quiz={PREVIEW_QUIZ}
            question={session.view.question}
            questions={session.state.questions}
            canEdit
            suggestions={SUGGESTIONS}
            initialMessages={chatMessages}
            onResponse={(response, sent) => {
              setFailure(
                response.ok
                  ? null
                  : {
                      status: response.status,
                      retryAfter: response.headers.get("Retry-After"),
                    },
              );
              return response.status >= 500
                ? explainOffline(sent.messages, session.view.question)
                : undefined;
            }}
          >
            {(runtime) => (
              <DemoChat
                runtime={runtime}
                session={session}
                failure={failure}
                onNewConversation={() => {
                  runtime.clearError();
                  runtime.setMessages([]);
                  setFailure(null);
                }}
              />
            )}
          </ChatRuntime>
        </div>
      </PreviewRuntime>
    </PreviewSandbox>
  );
}
