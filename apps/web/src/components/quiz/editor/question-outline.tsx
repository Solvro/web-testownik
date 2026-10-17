"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { moveRovingFocus } from "@/lib/roving-focus";
import { cn } from "@/lib/utils";

import {
  emptyLabel,
  useQuestionSummary,
  visibleIssue,
} from "./question-summary";
import type { QuizEditorForm } from "./quiz-editor-form";

export function QuestionSearch({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <InputGroup className={cn("bg-card dark:bg-card", className)}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        aria-label="Szukaj w pytaniach i odpowiedziach"
        placeholder="Szukaj w pytaniach…"
        className="text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
          } else if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            onChange("");
          }
        }}
      />
      {value === "" ? null : (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Wyczyść wyszukiwanie"
            onClick={() => {
              onChange("");
            }}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

/** Room for the fixed app footer below the list. */
const FOOTER_SPACE = 64;
/** The aside's `gap-4`. */
const COLUMN_GAP = 16;

/** A compact table of contents beside the questions. */
export function QuestionOutline({
  form,
  rows,
  activeId,
  showErrors,
  onSelect,
  className,
}: {
  form: QuizEditorForm;
  rows: { index: number; id: string }[];
  activeId: string;
  /** Marks questions which block saving, after a save attempt. */
  showErrors: boolean;
  /** `fromKeyboard` moves focus into the opened question. */
  onSelect: (id: string, fromKeyboard: boolean) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  // One tab stop for the whole list; the arrow keys move between items.
  const [focusId, setFocusId] = useState("");
  const tabbableId = rows.some((row) => row.id === focusId)
    ? focusId
    : rows.some((row) => row.id === activeId)
      ? activeId
      : (rows.at(0)?.id ?? "");

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-question-link="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  useEffect(() => {
    const list = listRef.current;
    if (list === null) {
      return;
    }
    // Fill the space between the list's top and the fixed app footer. The top
    // moves while the page scrolls, until the column sticks.
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { top } = list.getBoundingClientRect();
        // Whatever follows the list in the column, such as an add button.
        const after = list.parentElement?.nextElementSibling;
        const reserved =
          after instanceof HTMLElement ? after.offsetHeight + COLUMN_GAP : 0;
        list.style.maxHeight = `${String(Math.max(192, window.innerHeight - top - FOOTER_SPACE - reserved))}px`;
      });
    };
    fit();
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <nav aria-label="Spis pytań" className={cn("min-h-0", className)}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Arrow keys move between the buttons inside. */}
      <ol
        ref={listRef}
        aria-label="Lista pytań"
        aria-keyshortcuts="ArrowUp ArrowDown Home End"
        className="border-border overflow-y-auto overscroll-contain border-l py-0.5"
        onFocus={(event) => {
          const id = event.target.dataset.questionLink;
          if (id !== undefined) {
            setFocusId(id);
          }
        }}
        onKeyDown={(event) => {
          moveRovingFocus(event, "[data-question-link]", "vertical");
        }}
      >
        {rows.map(({ index, id }) => (
          <OutlineItem
            key={id}
            form={form}
            index={index}
            active={id === activeId}
            tabbable={id === tabbableId}
            showErrors={showErrors}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </nav>
  );
}

function OutlineItem({
  form,
  index,
  active,
  tabbable,
  showErrors,
  onSelect,
}: {
  form: QuizEditorForm;
  index: number;
  active: boolean;
  tabbable: boolean;
  showErrors: boolean;
  onSelect: (id: string, fromKeyboard: boolean) => void;
}) {
  const summary = useQuestionSummary(form, index);
  if (summary === null) {
    return null;
  }
  const issue = visibleIssue(summary.issue, active, showErrors);

  return (
    <li>
      <button
        type="button"
        data-question-link={summary.id}
        aria-label={`Przejdź do pytania ${String(index + 1)}: ${summary.text === "" ? emptyLabel(summary) : summary.text}`}
        aria-current={active ? "true" : undefined}
        tabIndex={tabbable ? 0 : -1}
        onClick={(event) => {
          // `detail` is 0 when Enter or Space pressed the button.
          onSelect(summary.id, event.detail === 0);
        }}
        className={cn(
          "focus-visible:outline-primary -ml-px flex w-full items-center gap-2 rounded-r-md border-l-2 py-1.5 pr-1 pl-4 text-left text-sm leading-6 transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid",
          active
            ? "border-primary text-foreground font-semibold"
            : "text-muted-foreground hover:text-foreground border-transparent",
          issue === "no-correct" && "text-amber-700 dark:text-amber-400",
          issue === "missing" && "text-destructive",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="tabular-nums">{String(index + 1)}</span>
          <span aria-hidden="true"> · </span>
          <span className={cn(summary.text === "" && "italic")}>
            {summary.text === "" ? emptyLabel(summary) : summary.text}
          </span>
        </span>
        {issue === null ? null : (
          <span
            role="img"
            aria-label={
              issue === "missing"
                ? "Wymaga uzupełnienia"
                : "Brak poprawnej odpowiedzi"
            }
            className={cn(
              "size-2 shrink-0 rounded-full",
              issue === "missing" ? "bg-destructive" : "bg-amber-600",
            )}
          />
        )}
      </button>
    </li>
  );
}
