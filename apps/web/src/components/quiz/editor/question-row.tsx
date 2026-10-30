"use client";

import { ChevronDownIcon, ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  emptyLabel,
  useQuestionSummary,
  visibleIssue,
} from "./question-summary";
import type { QuizEditorForm } from "./quiz-editor-form";
import { plural } from "./version-history";

/** A collapsed question: its preview and status. Clicking opens it. */
export function QuestionRow({
  form,
  index,
  tabbable,
  showErrors,
  onOpen,
}: {
  form: QuizEditorForm;
  index: number;
  /** Only one row is in the tab order; the arrow keys move between rows. */
  tabbable: boolean;
  showErrors: boolean;
  /** `fromKeyboard` moves focus into the opened question. */
  onOpen: (id: string, fromKeyboard: boolean) => void;
}) {
  const summary = useQuestionSummary(form, index);
  if (summary === null) {
    return null;
  }
  const issue = visibleIssue(summary.issue, false, showErrors);
  const blocking =
    issue === "missing" || issue === "conflict" || issue === "missing-correct";
  const number = String(index + 1);
  const text = summary.text === "" ? emptyLabel(summary) : summary.text;
  const status =
    issue === "missing"
      ? "Wymaga uzupełnienia"
      : issue === "conflict"
        ? "Kilka poprawnych odpowiedzi"
        : issue === "no-correct" || issue === "missing-correct"
          ? "Brak poprawnej odpowiedzi"
          : summary.type === "true_false"
            ? "Prawda/Fałsz"
            : summary.type === "open"
              ? `Otwarte, ${String(summary.answers)} ${plural(summary.answers, "akceptowana odpowiedź", "akceptowane odpowiedzi", "akceptowanych odpowiedzi")}`
              : `${String(summary.answers)} ${plural(summary.answers, "odpowiedź", "odpowiedzi", "odpowiedzi")}, ${String(summary.correct)} ${plural(summary.correct, "poprawna", "poprawne", "poprawnych")}`;

  return (
    <button
      type="button"
      data-question-row={summary.id}
      tabIndex={tabbable ? 0 : -1}
      aria-expanded={false}
      aria-label={`Pytanie ${number}: ${text}, ${status}`}
      onClick={(event) => {
        // `detail` is 0 when Enter or Space pressed the button.
        onOpen(summary.id, event.detail === 0);
      }}
      className={cn(
        "bg-card focus-visible:outline-primary flex w-full items-center gap-3 rounded-xl border px-4 py-4 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid sm:gap-4 sm:px-5",
        blocking
          ? "border-destructive/50 hover:border-destructive"
          : issue === "no-correct"
            ? "border-amber-500/60 hover:border-amber-500"
            : "border-border hover:border-foreground/25",
      )}
    >
      <span className="text-muted-foreground w-7 shrink-0 tabular-nums">
        {number}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          summary.text === "" && "italic",
          summary.text === "" && issue === "missing" && "text-destructive",
        )}
      >
        {text}
      </span>
      {summary.image && summary.text !== "" ? (
        <ImageIcon
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      ) : null}
      <span
        className={cn(
          "hidden shrink-0 text-sm sm:inline",
          blocking
            ? "text-destructive"
            : issue === "no-correct"
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground tabular-nums",
        )}
      >
        {status}
      </span>
      {issue === null ? null : (
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full sm:hidden",
            blocking ? "bg-destructive" : "bg-amber-600",
          )}
        />
      )}
      <ChevronDownIcon
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}
