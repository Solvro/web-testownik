"use client";

import { Bot, MessageSquareText, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../../components/focus";
import { MonoLabel } from "../../components/typography";
import { DemoHeader, DemoPanel } from "./demo-panel";

const PROMPTS = [
  {
    label: "Wyjaśnij prościej",
    response:
      "Samo czytanie mówi Ci: „to wygląda znajomo”. Aktywne przypominanie sprawdza, czy potrafisz odtworzyć wiedzę bez podpowiedzi — i właśnie ten wysiłek wzmacnia pamięć.",
  },
  {
    label: "Podaj przykład",
    response:
      "Zamknij notatki i spróbuj wypisać najważniejsze pojęcia z pamięci. Dopiero potem porównaj odpowiedź z materiałem i popraw brakujące elementy.",
  },
  {
    label: "Utwórz podobne",
    response:
      "Nowe pytanie: dlaczego samodzielne rozwiązanie zadania zwykle daje trwalszy efekt niż śledzenie gotowego rozwiązania krok po kroku?",
  },
];

/** Illustrates that the assistant answers inside the context of a question. */
export function AiDemo(): React.JSX.Element {
  const [activePrompt, setActivePrompt] = useState(PROMPTS[0]);

  return (
    <DemoPanel>
      <DemoHeader>
        <MonoLabel className="flex items-center gap-2">
          <Bot aria-hidden="true" className="text-primary size-4" />
          ASYSTENT QUIZU
        </MonoLabel>
        <MonoLabel tone="default">GPT-5.4 MINI</MonoLabel>
      </DemoHeader>

      <div className="border-border bg-card mt-6 rounded-[0.65rem] border p-4">
        <MonoLabel size="xs">AKTYWNE PYTANIE / 83</MonoLabel>
        <p className="mt-[0.7rem] text-[1.15rem] leading-[1.45]">
          Dlaczego aktywne przypominanie działa lepiej niż ponowne czytanie?
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[2.4rem_1fr] gap-[0.8rem] rounded-[0.65rem] border border-[color-mix(in_oklch,var(--primary)_42%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] p-[1.2rem]">
        <Sparkles aria-hidden="true" className="text-primary size-[1.3rem]" />
        <div>
          <MonoLabel size="xs">WYJAŚNIENIE W KONTEKŚCIE QUIZU</MonoLabel>
          <p className="mt-[0.65rem] leading-[1.6]">{activePrompt.response}</p>
        </div>
      </div>

      <div className="mt-[1.1rem] flex flex-wrap gap-[0.55rem]">
        {PROMPTS.map((prompt) => (
          <button
            type="button"
            key={prompt.label}
            aria-pressed={prompt === activePrompt}
            onClick={() => {
              setActivePrompt(prompt);
            }}
            className={cn(
              "border-border bg-card text-foreground hover:border-primary hover:text-primary aria-pressed:border-primary aria-pressed:text-primary inline-flex items-center gap-[0.45rem] rounded-full border px-3 py-[0.6rem] [&_svg]:size-[0.85rem]",
              FOCUS_RING,
            )}
          >
            <MessageSquareText aria-hidden="true" />
            {prompt.label}
          </button>
        ))}
      </div>
    </DemoPanel>
  );
}
