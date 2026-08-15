"use client";

import {
  BotMessageSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  SendIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../../components/focus";

const CONVERSATIONS = [
  {
    question: "Dlaczego pozostałe odpowiedzi brzmią tak przekonująco?",
    answer:
      "Bo opisują strategie, które dają szybkie poczucie znajomości materiału. Ponowne czytanie i podkreślanie są łatwe, ale nie sprawdzają, czy umiesz odtworzyć wiedzę bez podpowiedzi. Aktywne przypominanie właśnie to testuje.",
  },
  {
    question: "Ułóż trudniejszy wariant tego pytania.",
    answer:
      "Jasne: student rozpoznaje wszystkie pojęcia w notatkach, ale nie potrafi ich wyjaśnić bez patrzenia. Która zmiana planu nauki najlepiej ograniczy tę iluzję wiedzy — i dlaczego?",
  },
  {
    question: "Sprawdź mnie bez podpowiedzi.",
    answer:
      "Odłóż notatki. Wyjaśnij własnymi słowami, dlaczego trudność przypominania może poprawiać zapamiętywanie. Potem podaj jeden sposób, jak wykorzystasz to podczas najbliższej powtórki.",
  },
] as const;

type Conversation = (typeof CONVERSATIONS)[number];

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
}

export function AiDemo(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<Conversation | null>(null);
  const nextMessageId = useRef(0);
  const promptRail = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const responseTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  useEffect(
    () => () => {
      if (responseTimeout.current !== undefined) {
        window.clearTimeout(responseTimeout.current);
      }
    },
    [],
  );

  const addConversation = (conversation: Conversation): void => {
    // One local response at a time keeps repeated clicks from flooding the
    // transcript while still making each completed prompt a separate message.
    if (pending !== null) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: nextMessageId.current++,
        role: "user",
        text: conversation.question,
      },
    ]);
    setPending(conversation);
    responseTimeout.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId.current++,
          role: "assistant",
          text: conversation.answer,
        },
      ]);
      setPending(null);
    }, 850);
  };

  const scrollPrompts = (direction: -1 | 1): void => {
    promptRail.current?.scrollBy({
      left: direction * promptRail.current.clientWidth * 0.72,
      behavior: "smooth",
    });
  };

  return (
    <div className="bg-background text-foreground flex h-full min-h-[35rem] flex-col overflow-hidden rounded-[1rem] border shadow-xl shadow-black/5">
      <header className="border-border flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <span className="bg-primary/10 grid size-9 place-items-center rounded-full">
          <BotMessageSquareIcon
            aria-hidden="true"
            className="text-primary size-4.5"
          />
        </span>
        <div className="min-w-0">
          <strong className="block text-sm">Asystent AI</strong>
          <span className="text-muted-foreground block truncate text-xs">
            Jak uczyć się skuteczniej? · pytanie 8 z 12
          </span>
        </div>
      </header>

      <div
        ref={transcript}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
      >
        <div className="border-border bg-card mx-auto max-w-[34rem] rounded-xl border p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <CircleHelpIcon aria-hidden="true" className="size-3.5" />
            Aktywne pytanie
          </div>
          <p className="mt-2 text-sm leading-relaxed font-semibold sm:text-base">
            Która strategia najlepiej pomaga trwale zapamiętać materiał przed
            egzaminem?
          </p>
          <p className="text-primary mt-2 text-xs font-semibold">
            Wybrano: aktywne przypominanie i powtórki w odstępach
          </p>
        </div>

        <div
          className="mx-auto mt-7 flex max-w-[34rem] flex-col gap-4"
          aria-live="polite"
        >
          {messages.length === 0 && pending === null ? (
            <p className="text-muted-foreground max-w-[29rem] text-sm leading-relaxed">
              Wybierz jedną z podpowiedzi na dole. Asystent odpowie w kontekście
              tego pytania.
            </p>
          ) : null}
          {messages.map((message) =>
            message.role === "user" ? (
              <div
                key={message.id}
                className="bg-primary text-primary-foreground animate-lp-rise ml-auto max-w-[82%] rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed"
              >
                {message.text}
              </div>
            ) : (
              <div
                key={message.id}
                className="animate-lp-rise flex items-start gap-3"
              >
                <span className="bg-primary/10 mt-1 grid size-8 shrink-0 place-items-center rounded-full">
                  <BotMessageSquareIcon
                    aria-hidden="true"
                    className="text-primary size-4"
                  />
                </span>
                <div className="bg-secondary max-w-[88%] rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-[1.65]">
                  {message.text}
                </div>
              </div>
            ),
          )}
          {pending === null ? null : (
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 mt-1 grid size-8 shrink-0 place-items-center rounded-full">
                <BotMessageSquareIcon
                  aria-hidden="true"
                  className="text-primary size-4"
                />
              </span>
              <div className="bg-secondary text-muted-foreground flex items-center gap-2 rounded-2xl rounded-tl-md px-4 py-3 text-sm font-medium">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="bg-primary size-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
                  <span className="bg-primary size-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
                  <span className="bg-primary size-1.5 animate-bounce rounded-full" />
                </span>
                Myślę…
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Pokaż wcześniejsze podpowiedzi"
            onClick={() => {
              scrollPrompts(-1);
            }}
            className={cn(
              "text-muted-foreground hover:text-foreground grid size-8 shrink-0 place-items-center rounded-full transition-colors",
              FOCUS_RING,
            )}
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </button>
          <div
            ref={promptRail}
            className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]"
          >
            {CONVERSATIONS.map((conversation) => (
              <button
                type="button"
                key={conversation.question}
                disabled={pending !== null}
                onClick={() => {
                  addConversation(conversation);
                }}
                className={cn(
                  "border-border hover:border-primary/60 hover:text-primary flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                  FOCUS_RING,
                )}
              >
                {conversation.question}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Pokaż kolejne podpowiedzi"
            onClick={() => {
              scrollPrompts(1);
            }}
            className={cn(
              "text-muted-foreground hover:text-foreground grid size-8 shrink-0 place-items-center rounded-full transition-colors",
              FOCUS_RING,
            )}
          >
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="border-border text-muted-foreground mt-3 flex items-center rounded-xl border px-3 py-2.5 text-sm">
          <span className="flex-1">Napisz własne pytanie…</span>
          <SendIcon aria-hidden="true" className="text-primary size-4" />
        </div>
      </div>
    </div>
  );
}
