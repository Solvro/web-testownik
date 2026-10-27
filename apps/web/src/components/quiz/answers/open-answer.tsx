"use client";

import {
  acceptedAnswers,
  gradeResponse,
  matchesOpenAnswer,
} from "@testownik/core/quiz/grading";
import type { Question } from "@testownik/core/quiz/types";
import { CheckIcon, SparklesIcon } from "lucide-react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The typed answer of an open question. Enter checks it; afterwards the
 * field shows whether it was accepted, and the accepted answers when not.
 */
export function OpenAnswer({
  question,
  response,
  checked,
  graded = null,
  onChange,
  onSubmit,
}: {
  question: Question;
  /** The typed text, or "" before typing. */
  response: string;
  checked: boolean;
  /** The recorded grade of a history entry, instead of grading `response`. */
  graded?: boolean | null;
  onChange: (response: string) => void;
  onSubmit: () => void;
}) {
  const accepted = acceptedAnswers(question);
  const correct =
    checked &&
    (graded ?? gradeResponse(question, response === "" ? [] : [response]));
  const exact =
    correct &&
    response !== "" &&
    matchesOpenAnswer(response, accepted, "exact");
  const markdown = question.is_markdown_enabled !== false;
  // A skipped question or a self-graded flashcard has nothing typed to show.
  const showInput = !(checked && response === "");

  return (
    <div className="space-y-3">
      {showInput ? (
        <Input
          key={`open-answer-${question.id}`}
          id={`open-answer-${question.id}`}
          aria-label="Twoja odpowiedź"
          value={response}
          disabled={checked}
          autoFocus={!checked}
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Wpisz odpowiedź i naciśnij Enter"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              response.trim() !== ""
            ) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className={cn(
            "h-12 text-base md:text-base",
            checked &&
              (correct
                ? "border-green-500 bg-green-500/10 text-green-700 disabled:opacity-100 dark:text-green-400"
                : "border-red-500 bg-red-500/10 text-red-700 disabled:opacity-100 dark:text-red-400"),
          )}
        />
      ) : null}
      {checked ? (
        <div className="space-y-2 text-sm">
          {correct && !exact && response !== "" ? (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <SparklesIcon className="size-3.5 shrink-0" aria-hidden="true" />
              Zaliczono z tolerancją literówek.
            </p>
          ) : null}
          {correct && (exact || response === "") ? null : (
            <div className="space-y-1.5">
              <p className="text-muted-foreground">
                {accepted.length === 1
                  ? "Poprawna odpowiedź:"
                  : "Akceptowane odpowiedzi:"}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {accepted.map((answer) => (
                  <li
                    key={answer}
                    className="flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1 font-medium text-green-700 dark:text-green-400"
                  >
                    <CheckIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <MarkdownRenderer className="text-sm" enabled={markdown}>
                      {answer}
                    </MarkdownRenderer>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : question.open_matching === "similar" ? (
        <p className="text-muted-foreground text-xs">
          Drobne literówki i brak polskich znaków są tolerowane.
        </p>
      ) : null}
    </div>
  );
}
