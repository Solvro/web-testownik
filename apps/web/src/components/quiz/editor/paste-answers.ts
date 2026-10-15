import type { QuestionFormData } from "@testownik/core/quiz/schema";

import { createAnswer } from "./quiz-editor-factories";
import { hasImage } from "./quiz-editor-form";

const LIST_MARKER = /^\s*(?:[-*•]|\(?[a-z\d]{1,2}[.)])\s+/i;

/**
 * Splits pasted text into answer lines. List markers such as `a)`, `B.`,
 * `1)` or `-` are removed when every line has one. Returns null for text
 * which should stay in one answer.
 */
export function splitPastedAnswers(text: string) {
  if (text.includes("```") || text.includes("$$")) {
    return null;
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return null;
  }
  return lines.every((line) => LIST_MARKER.test(line))
    ? lines.map((line) => line.replace(LIST_MARKER, ""))
    : lines;
}

/**
 * Puts the first line into the given answer and the following lines into
 * the next empty answers, adding answers when needed.
 */
export function insertPastedAnswers(
  question: QuestionFormData,
  answerId: string,
  lines: string[],
): QuestionFormData {
  const index = question.answers.findIndex((answer) => answer.id === answerId);
  if (index === -1) {
    return question;
  }
  const answers = [...question.answers];
  for (const [offset, text] of lines.entries()) {
    const position = index + offset;
    const existing = answers.at(position);
    if (
      existing !== undefined &&
      (offset === 0 || (existing.text.trim() === "" && !hasImage(existing)))
    ) {
      answers[position] = { ...existing, text };
    } else {
      answers.splice(position, 0, { ...createAnswer(0), text });
    }
  }
  return {
    ...question,
    answers: answers.map((answer, order) => ({ ...answer, order: order + 1 })),
  };
}

/** What splitting a paste changed, so it can be reversed on its own. */
export interface PastedAnswers {
  /** The answer the text was pasted into. */
  answerId: string;
  /** The text as pasted. */
  text: string;
  /** Lines put into existing empty answers, by answer ID. */
  filled: Map<string, string>;
  /** Lines put into new answers, by answer ID. */
  inserted: Map<string, string>;
}

export function describePaste(
  before: QuestionFormData["answers"],
  after: QuestionFormData["answers"],
  answerId: string,
  text: string,
): PastedAnswers {
  const previous = new Map(before.map((answer) => [answer.id, answer.text]));
  const filled = new Map<string, string>();
  const inserted = new Map<string, string>();
  for (const answer of after) {
    if (answer.id === answerId) {
      continue;
    }
    const old = previous.get(answer.id);
    if (old === undefined) {
      inserted.set(answer.id, answer.text);
    } else if (old !== answer.text) {
      filled.set(answer.id, answer.text);
    }
  }
  return { answerId, text, filled, inserted };
}

/**
 * Puts the pasted text back into one answer. Only answers which still hold
 * their pasted line are emptied or removed, so later edits stay.
 */
export function joinPastedAnswers(
  question: QuestionFormData,
  paste: PastedAnswers,
): QuestionFormData {
  if (!question.answers.some((answer) => answer.id === paste.answerId)) {
    return question;
  }
  const untouched = (
    answer: QuestionFormData["answers"][number],
    lines: Map<string, string>,
  ) => lines.get(answer.id) === answer.text && !hasImage(answer);
  return {
    ...question,
    answers: question.answers
      .filter((answer) => !untouched(answer, paste.inserted))
      .map((answer, order) => ({
        ...answer,
        order: order + 1,
        text:
          answer.id === paste.answerId
            ? paste.text
            : untouched(answer, paste.filled)
              ? ""
              : answer.text,
      })),
  };
}
