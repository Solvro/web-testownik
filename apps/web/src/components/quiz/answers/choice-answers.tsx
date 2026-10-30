"use client";

import type { Question } from "@testownik/core/quiz/types";
import { SparklesIcon } from "lucide-react";

import type { AnswerHint } from "@/components/ai/ai-explain-card";
import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { computeAnswerVariant } from "@/components/quiz/helpers/question-card";
import { cn } from "@/lib/utils";

/**
 * The answers of a choice question as buttons. True/false shows its two
 * labels side by side, in their fixed order.
 */
export function ChoiceAnswers({
  question,
  selectedAnswers,
  checked,
  onToggle,
  answerHints = [],
}: {
  question: Question;
  selectedAnswers: string[];
  checked: boolean;
  onToggle: (answerId: string) => void;
  answerHints?: AnswerHint[];
}) {
  const trueFalse = question.type === "true_false";
  const markdown = question.is_markdown_enabled !== false;

  return (
    <div
      className={cn("gap-2", trueFalse ? "grid grid-cols-2" : "flex flex-col")}
      role="group"
      aria-label="Odpowiedzi"
    >
      {question.answers.map((answer, answerIndex) => {
        const hint = answerHints.find((h) => h.answerIndex === answerIndex);
        return (
          <div key={`answer-wrapper-${answer.id}`} className="group/answer">
            <button
              id={`answer-${answer.id}`}
              type="button"
              onClick={() => {
                onToggle(answer.id);
              }}
              disabled={checked}
              aria-pressed={selectedAnswers.includes(answer.id)}
              className={cn(
                "bg-input dark:bg-background focus-visible:ring-ring w-full rounded-md border px-4 py-3 font-medium wrap-break-word transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
                trueFalse
                  ? "flex min-h-16 items-center justify-center text-center"
                  : "justify-start text-left",
                computeAnswerVariant(
                  selectedAnswers.includes(answer.id),
                  checked,
                  answer.is_correct,
                ),
              )}
            >
              <MarkdownRenderer
                className={cn(
                  "pointer-events-none w-full",
                  trueFalse ? "text-base" : "text-sm",
                )}
                enabled={markdown}
              >
                {answer.text}
              </MarkdownRenderer>
              <ImageLoad
                key={`answer-image-${question.id}-${answer.id}`}
                url={answer.image}
                alt={answer.text}
                width={answer.image_width}
                height={answer.image_height}
                className="mx-auto max-h-40 rounded object-contain"
              />
            </button>
            <div
              className={cn(
                "grid transition-all duration-300 ease-out",
                hint === undefined
                  ? "grid-rows-[0fr] opacity-0"
                  : "mt-1.5 grid-rows-[1fr] opacity-100",
              )}
            >
              <div className="overflow-hidden">
                <div className="border-primary/10 bg-primary/5 flex items-start gap-2 rounded-lg border px-3 py-2">
                  <SparklesIcon className="text-primary mt-0.5 size-3.5 shrink-0" />
                  <MarkdownRenderer className="text-primary text-xs leading-relaxed">
                    {hint?.hint ?? ""}
                  </MarkdownRenderer>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
