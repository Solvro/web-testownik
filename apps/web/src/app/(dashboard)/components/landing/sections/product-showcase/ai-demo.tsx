"use client";

import {
  BotMessageSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  InfoIcon,
  SendIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  LANDING_DEMO_ENDPOINT,
  LANDING_DEMO_LIMITS,
} from "@/lib/ai/landing-demo";
import type { LandingDemoMessage } from "@/lib/ai/landing-demo";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../../components/focus";

/**
 * Suggestion chips. `answer` is only used when the live assistant is
 * unavailable, so the demo still shows a sensible reply.
 */
const SUGGESTIONS = [
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

const UNAVAILABLE_NOTICE =
  "Asystent jest teraz niedostępny. Wybierz jedną z podpowiedzi albo spróbuj ponownie za chwilę.";

interface ChatMessage {
  id: number;
  role: "assistant" | "notice" | "user";
  text: string;
}

type Phase = "idle" | "streaming" | "waiting";

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

/** Recent completed turns, trimmed to what the demo endpoint accepts. */
function buildHistory(
  messages: readonly ChatMessage[],
  prompt: string,
): LandingDemoMessage[] {
  const turns = messages
    .filter(
      (message): message is ChatMessage & { role: "assistant" | "user" } =>
        message.role !== "notice" && message.text.trim() !== "",
    )
    .map((message) => ({
      role: message.role,
      content: message.text
        .trim()
        .slice(
          0,
          message.role === "user"
            ? LANDING_DEMO_LIMITS.maxUserMessageLength
            : LANDING_DEMO_LIMITS.maxAssistantMessageLength,
        ),
    }))
    .slice(-(LANDING_DEMO_LIMITS.maxMessages - 1));
  // The endpoint expects user-first alternation to read naturally; drop a
  // leading assistant turn left over from trimming.
  if (turns[0]?.role === "assistant") {
    turns.shift();
  }
  return [...turns, { role: "user", content: prompt }];
}

export function AiDemo(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState("");
  const nextMessageId = useRef(0);
  const promptRail = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, phase]);

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );

  const appendMessage = (role: ChatMessage["role"], text: string): number => {
    const id = nextMessageId.current++;
    setMessages((current) => [...current, { id, role, text }]);
    return id;
  };

  const ask = async (prompt: string, cannedAnswer?: string): Promise<void> => {
    const text = prompt.trim();
    // One response at a time keeps repeated clicks from flooding the
    // transcript (and the rate limit).
    if (inFlight.current !== null || text === "") {
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    const history = buildHistory(messages, text);
    appendMessage("user", text);
    setPhase("waiting");

    const fallback = (): void => {
      if (cannedAnswer === undefined) {
        appendMessage("notice", UNAVAILABLE_NOTICE);
      } else {
        appendMessage("assistant", cannedAnswer);
      }
    };

    let received = "";
    try {
      const response = await fetch(LANDING_DEMO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        appendMessage(
          "notice",
          `To tylko pokaz, więc liczba pytań jest ograniczona. Spróbuj ponownie ${formatRetryAfter(response.headers.get("Retry-After"))}.`,
        );
        return;
      }
      if (!response.ok || response.body === null) {
        fallback();
        return;
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let assistantId: number | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value === "") {
          continue;
        }
        received += value;
        const snapshot = received;
        if (assistantId === null) {
          assistantId = appendMessage("assistant", snapshot);
          setPhase("streaming");
        } else {
          const id = assistantId;
          setMessages((current) =>
            current.map((message) =>
              message.id === id ? { ...message, text: snapshot } : message,
            ),
          );
        }
      }
      if (received.trim() === "") {
        fallback();
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      console.error("Landing AI demo request failed", error);
      // Keep a partially streamed answer; otherwise show the fallback.
      if (received.trim() === "") {
        fallback();
      }
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setPhase("idle");
      }
    }
  };

  const submitDraft = (): void => {
    if (phase !== "idle" || draft.trim() === "") {
      return;
    }
    const prompt = draft;
    setDraft("");
    void ask(prompt);
  };

  const scrollPrompts = (direction: -1 | 1): void => {
    promptRail.current?.scrollBy({
      left: direction * promptRail.current.clientWidth * 0.72,
      behavior: "smooth",
    });
  };

  const busy = phase !== "idle";

  return (
    <div className="bg-background text-foreground flex h-full max-h-[35rem] min-h-[32rem] flex-col overflow-hidden rounded-[1rem] border shadow-xl shadow-black/5 sm:min-h-[35rem] lg:max-h-none">
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
        <div className="border-border bg-card mx-auto max-w-[48rem] rounded-xl border p-4">
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
          className="mx-auto mt-7 flex max-w-[48rem] flex-col gap-4"
          aria-live="polite"
          aria-busy={busy}
        >
          {messages.length === 0 && !busy ? (
            <p className="text-muted-foreground max-w-[29rem] text-sm leading-relaxed">
              Wybierz jedną z podpowiedzi na dole albo zadaj własne pytanie.
              Asystent odpowie w kontekście tego pytania.
            </p>
          ) : null}
          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div
                  key={message.id}
                  className="bg-primary text-primary-foreground animate-lp-rise ml-auto max-w-[82%] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap"
                >
                  {message.text}
                </div>
              );
            }
            if (message.role === "notice") {
              return (
                <p
                  key={message.id}
                  role="status"
                  className="text-muted-foreground animate-lp-rise flex items-start gap-2 text-xs leading-relaxed"
                >
                  <InfoIcon
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                  {message.text}
                </p>
              );
            }
            return (
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
                <div className="bg-secondary max-w-[88%] min-w-0 rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-[1.65]">
                  <MarkdownRenderer className="text-foreground prose-sm prose-strong:text-foreground prose-p:my-0 prose-p:leading-[1.65] text-sm leading-[1.65] break-words">
                    {message.text}
                  </MarkdownRenderer>
                </div>
              </div>
            );
          })}
          {phase === "waiting" ? (
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 mt-1 grid size-8 shrink-0 place-items-center rounded-full">
                <BotMessageSquareIcon
                  aria-hidden="true"
                  className="text-primary size-4"
                />
              </span>
              <div className="bg-secondary text-muted-foreground flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-3 text-sm font-medium">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="bg-primary size-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
                  <span className="bg-primary size-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
                  <span className="bg-primary size-1.5 animate-bounce rounded-full" />
                </span>
                Myślę…
              </div>
            </div>
          ) : null}
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
            {SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                key={suggestion.question}
                disabled={busy}
                onClick={() => {
                  void ask(suggestion.question, suggestion.answer);
                }}
                className={cn(
                  "border-border hover:border-primary/60 hover:text-primary flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                  FOCUS_RING,
                )}
              >
                {suggestion.question}
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
        <form
          className="border-border focus-within:border-primary/60 mt-3 flex items-center gap-2 rounded-xl border py-1 pr-1 pl-3 text-sm transition-colors"
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <input
            type="text"
            value={draft}
            maxLength={LANDING_DEMO_LIMITS.maxUserMessageLength}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            placeholder="Napisz własne pytanie…"
            aria-label="Napisz własne pytanie do asystenta"
            autoComplete="off"
            enterKeyHint="send"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent py-1.5 outline-none"
          />
          <button
            type="submit"
            aria-label="Wyślij pytanie"
            disabled={busy || draft.trim() === ""}
            className={cn(
              "text-primary hover:bg-primary/10 grid size-8 shrink-0 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              FOCUS_RING,
            )}
          >
            <SendIcon aria-hidden="true" className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
