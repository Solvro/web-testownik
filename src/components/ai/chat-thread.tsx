"use client";

import type { UIMessage } from "ai";
import { ArrowUpIcon, SparklesIcon, SquareIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { ChatMessage } from "@/components/ai/chat-message";
import type { ChatRuntimeValue } from "@/components/ai/chat-runtime";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface ChatNotice {
  kind: "warning";
  message: string;
}

interface ChatThreadProps {
  runtime: ChatRuntimeValue;
  userName?: string;
  cooldownLabel?: string | null;
  composerStart?: ReactNode;
  composerDisabled?: boolean;
  composerDisabledMessage?: string;
  quotaNotice?: ChatNotice | null;
}

function hasRenderableAssistantContent(message: UIMessage) {
  return message.parts.some((part) => {
    if (part.type === "text") {
      return part.text.trim() !== "";
    }
    return (
      part.type === "file" ||
      part.type === "source-url" ||
      part.type === "dynamic-tool" ||
      part.type.startsWith("tool-")
    );
  });
}

function hasAssistantText(message: UIMessage) {
  return message.parts.some(
    (part) => part.type === "text" && part.text.trim() !== "",
  );
}

function Welcome({
  runtime,
  disabled,
  userName,
}: {
  runtime: ChatRuntimeValue;
  disabled: boolean;
  userName?: string;
}) {
  const { suggestions, sendMessage, clearError } = runtime;
  const greetingName = userName?.trim();
  return (
    <div className="flex flex-1 flex-col">
      <div className="my-auto flex flex-col justify-end gap-3 py-2">
        <div className="px-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {greetingName === undefined || greetingName === ""
              ? "Cześć!"
              : `Cześć, ${greetingName}!`}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-base">
            Jak mogę Ci pomóc?
          </p>
        </div>
      </div>
      <div className="grid gap-1.5 @md:grid-cols-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="ghost"
            className="h-auto justify-start rounded-xl px-3 py-2 text-start text-sm whitespace-normal"
            disabled={disabled}
            onClick={() => {
              clearError();
              void sendMessage({ text: suggestion });
            }}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Composer({
  start,
  disabled,
  disabledMessage,
  runtime,
}: {
  start?: ReactNode;
  disabled: boolean;
  disabledMessage?: string;
  runtime: ChatRuntimeValue;
}) {
  const { sendMessage, stop, status, clearError } = runtime;
  const [input, setInput] = useState("");
  const running = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (text === "" || disabled || running) {
      return;
    }
    clearError();
    setInput("");
    void sendMessage({ text });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <InputGroup
        data-disabled={disabled}
        className="bg-background rounded-2xl"
      >
        <InputGroupTextarea
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            running
              ? "Generuję odpowiedź…"
              : disabled
                ? (disabledMessage ?? "Limit AI został wykorzystany")
                : "Napisz wiadomość…"
          }
          disabled={disabled}
          rows={1}
          className="max-h-32 min-h-11 px-3 pt-3 pb-1 text-sm"
          aria-label="Wiadomość"
        />
        <InputGroupAddon
          align="block-end"
          className="min-w-0 justify-between gap-2 px-2.5 pt-1 pb-2"
        >
          <div className="min-w-0">{start}</div>
          {running ? (
            <InputGroupButton
              type="button"
              variant="default"
              size="icon-sm"
              className="shrink-0 rounded-full"
              aria-label="Zatrzymaj generowanie"
              onClick={() => {
                void stop();
              }}
            >
              <SquareIcon className="size-3 fill-current" />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              className="shrink-0 rounded-full"
              aria-label="Wyślij wiadomość"
              disabled={disabled || input.trim() === ""}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

export function ChatThread({
  runtime,
  userName,
  cooldownLabel,
  composerStart,
  composerDisabled = false,
  composerDisabledMessage,
  quotaNotice,
}: ChatThreadProps) {
  const {
    messages,
    status,
    error,
    clearError,
    regenerate,
    sendMessage,
    lengthLimitedMessageIds,
  } = runtime;
  const running = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const showThinking =
    running &&
    (lastMessage?.role === "user" ||
      (lastMessage?.role === "assistant" && !hasAssistantText(lastMessage)));
  const retryLastRequest = () => {
    if (composerDisabled || running) {
      return;
    }
    clearError();
    if (lastMessage?.role === "assistant") {
      void regenerate({ messageId: lastMessage.id });
      return;
    }
    void sendMessage();
  };

  return (
    <TooltipProvider>
      <div className="bg-background @container flex h-full flex-col">
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto w-full max-w-176 gap-2 px-4 pt-4 pb-6">
                {messages.length === 0 ? (
                  <Welcome
                    runtime={runtime}
                    disabled={composerDisabled || running}
                    userName={userName}
                  />
                ) : null}
                {messages.map((message, index) => {
                  if (
                    showThinking &&
                    index === messages.length - 1 &&
                    message.role === "assistant" &&
                    !hasRenderableAssistantContent(message)
                  ) {
                    return null;
                  }
                  return (
                    <MessageScrollerItem
                      key={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <ChatMessage
                        message={message}
                        running={
                          running ? index === messages.length - 1 : false
                        }
                        lengthLimited={lengthLimitedMessageIds.has(message.id)}
                        requestDisabled={composerDisabled || running}
                        requestDisabledLabel={
                          running
                            ? "Generowanie…"
                            : (cooldownLabel ?? "Niedostępne")
                        }
                        requestDisabledMessage={
                          running
                            ? "Poczekaj na zakończenie odpowiedzi"
                            : cooldownLabel === null ||
                                cooldownLabel === undefined
                              ? "Generowanie jest teraz niedostępne"
                              : `Dostępne ${cooldownLabel}`
                        }
                        sendMessage={sendMessage}
                        regenerate={regenerate}
                        clearError={clearError}
                        status={status}
                      />
                    </MessageScrollerItem>
                  );
                })}
                {showThinking ? (
                  <MessageScrollerItem>
                    <Marker role="status" aria-live="polite" className="py-2">
                      <MarkerContent className="shimmer text-muted-foreground">
                        Myślę…
                      </MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                ) : null}
                {error === undefined ? null : (
                  <MessageScrollerItem>
                    <Marker
                      className="text-destructive justify-between gap-3"
                      role="alert"
                    >
                      <MarkerContent className="flex-1">
                        Nie udało się wygenerować odpowiedzi.
                      </MarkerContent>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={composerDisabled || running}
                        onClick={retryLastRequest}
                      >
                        Spróbuj ponownie
                      </Button>
                    </Marker>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        <div className="bg-background shrink-0 px-4 pt-2 pb-4 md:pb-6">
          <div className="mx-auto flex w-full max-w-176 flex-col gap-1.5">
            {quotaNotice === null || quotaNotice === undefined ? null : (
              <Marker
                role="status"
                aria-live="polite"
                className="px-1.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
              >
                <MarkerIcon>
                  <SparklesIcon />
                </MarkerIcon>
                <MarkerContent className="tabular-nums">
                  {quotaNotice.message}
                </MarkerContent>
              </Marker>
            )}
            <Composer
              start={composerStart}
              disabled={composerDisabled}
              disabledMessage={composerDisabledMessage}
              runtime={runtime}
            />
            <AiDisclaimer className="px-1" />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
