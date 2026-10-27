"use client";

import { useSelector } from "@tanstack/react-form";
import type { QuestionFormData } from "@testownik/core/quiz/schema";
import type { QuestionType } from "@testownik/core/quiz/types";

import { hasImage, questionIssue } from "./quiz-editor-form";
import type { QuizEditorForm } from "./quiz-editor-form";

/** A one-line reading of Markdown for previews. LaTeX stays as typed. */
export function plainText(markdown: string) {
  return markdown
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replaceAll(/\*\*|__|`|~~/g, "")
    .replaceAll(/^\s{0,3}(?:#{1,6}|>)\s*/gm, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function matchesQuery(question: QuestionFormData, query: string) {
  return (
    question.text.toLocaleLowerCase("pl").includes(query) ||
    question.answers.some((answer) =>
      answer.text.toLocaleLowerCase("pl").includes(query),
    )
  );
}

export interface QuestionSummary {
  id: string;
  text: string;
  type: QuestionType;
  image: boolean;
  answers: number;
  correct: number;
  issue: ReturnType<typeof questionIssue>;
}

function sameSummary(a: QuestionSummary | null, b: QuestionSummary | null) {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.id === b.id &&
      a.text === b.text &&
      a.type === b.type &&
      a.image === b.image &&
      a.answers === b.answers &&
      a.correct === b.correct &&
      a.issue === b.issue)
  );
}

/** Rerenders only when the preview of the question at `index` changes. */
export function useQuestionSummary(form: QuizEditorForm, index: number) {
  return useSelector(
    form.atom,
    (state): QuestionSummary | null => {
      const question = state.values.questions.at(index);
      return question === undefined
        ? null
        : {
            id: question.id,
            text:
              question.is_markdown_enabled === false
                ? question.text.replaceAll(/\s+/g, " ").trim().slice(0, 200)
                : plainText(question.text),
            type: question.type,
            image: hasImage(question),
            answers: question.answers.length,
            correct: question.answers.filter((answer) => answer.is_correct)
              .length,
            issue: questionIssue(question),
          };
    },
    { compare: sameSummary },
  );
}

/**
 * `missing` and `missing-correct` block saving and show only after a save
 * attempt, so a question being written is not marked wrong straight away.
 * `conflict` comes from a deliberate change, so it shows at once.
 * `no-correct` is a reminder shown once the question is left, which is also
 * how `missing-correct` shows before a save attempt.
 */
export function visibleIssue(
  issue: QuestionSummary["issue"],
  active: boolean,
  showErrors: boolean,
) {
  if (issue === "missing" && showErrors) {
    return "missing";
  }
  if (issue === "conflict") {
    return "conflict";
  }
  if (issue === "missing-correct") {
    return showErrors ? "missing-correct" : active ? null : "no-correct";
  }
  if (issue === "no-correct" && !active) {
    return "no-correct";
  }
  return null;
}

export function emptyLabel(summary: QuestionSummary) {
  return summary.image ? "Pytanie ze zdjęciem" : "Bez treści";
}
