"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "./focus";
import { HandNote } from "./hand-note";

export function NotebookCheck(): React.JSX.Element {
  const [state, setState] = useState<"blank" | "checked" | "cancelled">(
    "blank",
  );

  return (
    <HandNote className="relative z-10 mt-6">
      <button
        type="button"
        role="checkbox"
        aria-checked={state === "checked"}
        data-ink-state={state}
        title="Odhacz pierwszy quiz. Kliknij ponownie, żeby zamazać zaznaczenie."
        onClick={() => {
          setState((current) =>
            current === "checked" ? "cancelled" : "checked",
          );
        }}
        className={cn(
          "lp-notebook-check inline-flex min-h-11 items-center gap-3 rounded-sm text-left",
          FOCUS_RING,
        )}
      >
        <svg
          aria-hidden="true"
          className="lp-check-drawing size-8 shrink-0 overflow-visible"
          viewBox="0 0 40 40"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            className="lp-check-box"
            d="m9 12 20-1 1 20-21 1Z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            className="lp-check-tick"
            pathLength="1"
            d="M4 20c4-3 7 2 11 10C18 20 22 6 30 0"
          />
          <path
            className="lp-check-scribble"
            pathLength="1"
            d="M1 11 33 3 4 27 35 13 8 36 34 24 13 40 38 34"
          />
        </svg>
        <span>Do zrobienia: pierwszy quiz.</span>
      </button>
    </HandNote>
  );
}
