"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  AlertTriangleIcon,
  CheckIcon,
  Clock3Icon,
  CopyIcon,
  FileIcon,
  PencilIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ChatMarkdown } from "@/components/ai/chat-markdown";
import { ChatTool, ChatToolGroup } from "@/components/ai/chat-tool";
import { isStandaloneToolResult } from "@/components/ai/chat-tool-part";
import type { ChatToolPart } from "@/components/ai/chat-tool-part";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function ActionButton({
  label,
  children,
  onClick,
  disabled = false,
  disabledLabel,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const tooltipLabel = disabled ? (disabledLabel ?? label) : label;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={tooltipLabel}
            aria-disabled={disabled}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={disabled ? undefined : onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}

function FilePart({
  part,
}: {
  part: Extract<UIMessage["parts"][number], { type: "file" }>;
}) {
  const title = part.filename ?? "Załącznik";
  return (
    <Attachment size="sm">
      <AttachmentMedia>
        <FileIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{title}</AttachmentTitle>
        <AttachmentDescription>{part.mediaType}</AttachmentDescription>
      </AttachmentContent>
      <AttachmentTrigger
        render={
          <a href={part.url} target="_blank" rel="noreferrer">
            <span className="sr-only">{title}</span>
          </a>
        }
        aria-label={`Otwórz załącznik ${title}`}
      />
    </Attachment>
  );
}

function UserChatMessage({
  message,
  requestDisabled,
  sendMessage,
  clearError,
  status,
  requestDisabledLabel,
}: {
  message: UIMessage;
  requestDisabled: boolean;
  sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
  clearError: UseChatHelpers<UIMessage>["clearError"];
  status: UseChatHelpers<UIMessage>["status"];
  requestDisabledLabel: string;
}) {
  const text = messageText(message);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  if (editing) {
    return (
      <Message align="end">
        <MessageContent className="max-w-[85%]">
          <form
            className="bg-muted flex flex-col gap-2 rounded-xl p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const next = draft.trim();
              if (
                next === "" ||
                requestDisabled ||
                status === "submitted" ||
                status === "streaming"
              ) {
                return;
              }
              clearError();
              setEditing(false);
              void sendMessage({ text: next, messageId: message.id });
            }}
          >
            <Textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              className="max-h-40 min-h-20 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
              aria-label="Edytuj wiadomość"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(text);
                  setEditing(false);
                }}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={requestDisabled || draft.trim() === ""}
              >
                {requestDisabled ? (
                  <>
                    <Clock3Icon />
                    <span className="tabular-nums" aria-live="polite">
                      {requestDisabledLabel}
                    </span>
                  </>
                ) : (
                  "Wyślij ponownie"
                )}
              </Button>
            </div>
          </form>
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message align="end">
      <MessageContent className="gap-1">
        <Bubble variant="muted" align="end" className="max-w-[85%]">
          {message.parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <BubbleContent
                  key={`text-${index.toString()}`}
                  className="whitespace-pre-wrap"
                >
                  {part.text}
                </BubbleContent>
              );
            }
            if (part.type === "file") {
              return <FilePart key={`file-${index.toString()}`} part={part} />;
            }
            return null;
          })}
        </Bubble>
        <MessageFooter className="-mt-0.5 justify-end opacity-100 md:opacity-0 md:transition-opacity md:group-focus-within/message:opacity-100 md:group-hover/message:opacity-100">
          <ActionButton
            label="Edytuj"
            onClick={() => {
              setEditing(true);
            }}
          >
            <PencilIcon />
          </ActionButton>
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

function AssistantChatMessage({
  message,
  running,
  lengthLimited,
  requestDisabled,
  requestDisabledMessage,
  regenerate,
  clearError,
}: {
  message: UIMessage;
  running: boolean;
  lengthLimited: boolean;
  requestDisabled: boolean;
  requestDisabledMessage: string;
  regenerate: UseChatHelpers<UIMessage>["regenerate"];
  clearError: UseChatHelpers<UIMessage>["clearError"];
}) {
  const text = useMemo(() => messageText(message), [message]);
  const [copied, setCopied] = useState(false);
  const activityParts = message.parts.flatMap((part) => {
    if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-")) {
      return [];
    }
    const toolPart = part as ChatToolPart;
    return isStandaloneToolResult(toolPart) ? [] : [toolPart];
  });
  const firstToolIndex = message.parts.findIndex(
    (part) =>
      (part.type === "dynamic-tool" || part.type.startsWith("tool-")) &&
      !isStandaloneToolResult(part as ChatToolPart),
  );

  return (
    <Message align="start">
      <MessageContent className="gap-1">
        <Bubble variant="ghost" className="w-full max-w-full">
          <BubbleContent className="flex w-full flex-col gap-2">
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <ChatMarkdown key={`text-${index.toString()}`}>
                    {part.text}
                  </ChatMarkdown>
                );
              }
              if (part.type === "file") {
                return (
                  <FilePart key={`file-${index.toString()}`} part={part} />
                );
              }
              if (
                part.type === "dynamic-tool" ||
                part.type.startsWith("tool-")
              ) {
                const toolPart = part as ChatToolPart;
                if (isStandaloneToolResult(toolPart)) {
                  return (
                    <ChatTool
                      key={toolPart.toolCallId ?? `tool-${index.toString()}`}
                      part={toolPart}
                      interrupted={lengthLimited}
                    />
                  );
                }
                return index === firstToolIndex ? (
                  <ChatToolGroup
                    key="tool-group"
                    parts={activityParts}
                    interrupted={lengthLimited}
                  />
                ) : null;
              }
              if (part.type === "source-url") {
                return (
                  <a
                    key={`source-${index.toString()}`}
                    href={part.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary block truncate text-xs underline underline-offset-2"
                  >
                    {part.title ?? part.url}
                  </a>
                );
              }
              return null;
            })}
          </BubbleContent>
        </Bubble>
        {lengthLimited ? (
          <Marker
            role="status"
            className="border-border/70 bg-muted/30 mt-1 rounded-lg border px-3 py-2 text-xs"
          >
            <MarkerIcon>
              <AlertTriangleIcon />
            </MarkerIcon>
            <MarkerContent>
              Odpowiedź została przerwana po osiągnięciu limitu długości.
              Spróbuj ponownie lub poproś o krótszą odpowiedź.
            </MarkerContent>
          </Marker>
        ) : null}
        {running ? null : (
          <MessageFooter className="-mt-0.5 gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-focus-within/message:opacity-100 md:group-hover/message:opacity-100">
            <ActionButton
              label={copied ? "Skopiowano" : "Kopiuj"}
              onClick={() => {
                void navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  window.setTimeout(() => {
                    setCopied(false);
                  }, 2000);
                });
              }}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </ActionButton>
            <ActionButton
              label="Wygeneruj ponownie"
              disabled={requestDisabled}
              disabledLabel={requestDisabledMessage}
              onClick={() => {
                clearError();
                void regenerate({ messageId: message.id });
              }}
            >
              <RefreshCwIcon />
            </ActionButton>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

export function ChatMessage({
  message,
  running,
  lengthLimited,
  requestDisabled,
  requestDisabledLabel,
  requestDisabledMessage,
  sendMessage,
  regenerate,
  clearError,
  status,
}: {
  message: UIMessage;
  running: boolean;
  lengthLimited: boolean;
  requestDisabled: boolean;
  requestDisabledLabel: string;
  requestDisabledMessage: string;
  sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
  regenerate: UseChatHelpers<UIMessage>["regenerate"];
  clearError: UseChatHelpers<UIMessage>["clearError"];
  status: UseChatHelpers<UIMessage>["status"];
}) {
  return message.role === "user" ? (
    <UserChatMessage
      message={message}
      requestDisabled={requestDisabled}
      sendMessage={sendMessage}
      clearError={clearError}
      status={status}
      requestDisabledLabel={requestDisabledLabel}
    />
  ) : (
    <AssistantChatMessage
      message={message}
      running={running}
      lengthLimited={lengthLimited}
      requestDisabled={requestDisabled}
      requestDisabledMessage={requestDisabledMessage}
      regenerate={regenerate}
      clearError={clearError}
    />
  );
}
