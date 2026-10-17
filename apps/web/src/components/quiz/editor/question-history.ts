import type { QuestionFormData } from "@testownik/core/quiz/schema";
import { useEffect, useReducer } from "react";

import { focusField } from "./focus-field";
import { updateQuestion } from "./quiz-editor-form";
import type { QuizEditorForm } from "./quiz-editor-form";

/** Typing which pauses for longer starts a new undo step. */
const TYPING_WINDOW = 1000;
const MAX_STEPS = 200;

interface QuestionHistory {
  /** The value the form holds now, as far as the history knows. */
  current: QuestionFormData;
  undo: QuestionFormData[];
  redo: QuestionFormData[];
  /** The field changed by the last recorded step, for merging typing. */
  lastField: string | null;
  lastAt: number;
  /** Set while undo or redo writes to the form, so the write is not recorded. */
  applying: boolean;
  listeners: Set<() => void>;
}

interface FormHistories {
  byId: Map<string, QuestionHistory>;
  unsubscribe: () => void;
}

// Kept per form and question, outside React, so a question's history
// survives collapsing its editor. One subscription per form follows every
// question with a history, so changes made while its editor is not mounted
// (bulk actions, undo toasts) are steps too and `current` never goes stale.
const histories = new WeakMap<QuizEditorForm, FormHistories>();

function findQuestion(form: QuizEditorForm, id: string) {
  return form.state.values.questions.find((question) => question.id === id);
}

function historiesOf(form: QuizEditorForm) {
  let entry = histories.get(form);
  if (entry === undefined) {
    const byId = new Map<string, QuestionHistory>();
    const subscription = form.atom.subscribe((state) => {
      for (const question of state.values.questions) {
        const history = byId.get(question.id);
        if (history !== undefined) {
          record(history, question);
        }
      }
    });
    entry = {
      byId,
      unsubscribe: () => {
        subscription.unsubscribe();
      },
    };
    histories.set(form, entry);
  }
  return entry;
}

function historyOf(form: QuizEditorForm, id: string) {
  const { byId } = historiesOf(form);
  let history = byId.get(id);
  if (history === undefined) {
    const question = findQuestion(form, id);
    if (question === undefined) {
      return null;
    }
    history = {
      current: question,
      undo: [],
      redo: [],
      lastField: null,
      lastAt: 0,
      applying: false,
      listeners: new Set(),
    };
    byId.set(id, history);
  }
  return history;
}

/** Forgets every question's history, e.g. after a version was restored. */
export function clearQuestionHistories(form: QuizEditorForm) {
  const entry = histories.get(form);
  if (entry === undefined) {
    return;
  }
  entry.unsubscribe();
  histories.delete(form);
  for (const history of entry.byId.values()) {
    history.undo = [];
    history.redo = [];
    history.lastField = null;
    notify(history);
  }
}

function notify(history: QuestionHistory) {
  for (const listener of history.listeners) {
    listener();
  }
}

/** The id of the text field with a different value in `after`, with the
 * position where the texts start to differ. */
function changedField(before: QuestionFormData, after: QuestionFormData) {
  const fields = [
    [`question-text-${after.id}`, before.text, after.text],
    [
      `explanation-${after.id}`,
      before.explanation ?? "",
      after.explanation ?? "",
    ],
    ...after.answers.map((answer) => [
      `answer-text-${answer.id}`,
      before.answers.find((other) => other.id === answer.id)?.text ?? "",
      answer.text,
    ]),
  ] as const;
  const changed = fields.filter(([, from, to]) => from !== to);
  if (changed.length !== 1) {
    return null;
  }
  const [id, from, to] = changed[0];
  let position = 0;
  while (
    position < from.length &&
    position < to.length &&
    from[position] === to[position]
  ) {
    position++;
  }
  return { id, position: Math.min(to.length, position + 1) };
}

function sameContent(a: QuestionFormData, b: QuestionFormData) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Only the text of one field differs, so the two are a typing burst. */
function onlyTextDiffers(
  a: QuestionFormData,
  b: QuestionFormData,
  field: string,
) {
  const strip = (question: QuestionFormData) =>
    JSON.stringify({
      ...question,
      text: "",
      explanation: "",
      answers: question.answers.map((answer) => ({ ...answer, text: "" })),
    });
  return (
    changedField(a, b)?.id === field &&
    strip(a) === strip(b) &&
    a.answers.length === b.answers.length
  );
}

function record(history: QuestionHistory, next: QuestionFormData) {
  const previous = history.current;
  history.current = next;
  if (history.applying || sameContent(previous, next)) {
    return;
  }
  history.redo = [];
  const now = Date.now();
  const field = changedField(previous, next)?.id ?? null;
  const merge =
    field !== null &&
    field === history.lastField &&
    now - history.lastAt <= TYPING_WINDOW &&
    history.undo.length > 0 &&
    onlyTextDiffers(previous, next, field);
  if (!merge) {
    history.undo.push(previous);
    if (history.undo.length > MAX_STEPS) {
      history.undo.shift();
    }
  }
  history.lastField = field;
  history.lastAt = now;
  notify(history);
}

function apply(
  form: QuizEditorForm,
  history: QuestionHistory,
  direction: "undo" | "redo",
) {
  const target = history[direction].pop();
  if (target === undefined) {
    return;
  }
  const from = history.current;
  history[direction === "undo" ? "redo" : "undo"].push(from);
  history.current = target;
  history.lastField = null;
  history.applying = true;
  try {
    updateQuestion(form, target.id, () => target);
  } finally {
    history.applying = false;
  }
  notify(history);
  const changed = changedField(from, target);
  if (changed !== null) {
    focusField(changed.id, changed.position);
    return;
  }
  // An answer which came back gets the focus; other changes keep it.
  const returned = target.answers.find(
    (answer) => !from.answers.some((other) => other.id === answer.id),
  );
  if (returned !== undefined) {
    focusField(`answer-text-${returned.id}`);
  }
}

export interface QuestionHistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/**
 * Undo and redo for every change to one question: its text, answers,
 * explanation, choice type and images. Each change to the question's form
 * value is a step, except typing which continues the previous step.
 */
export function useQuestionHistory(
  form: QuizEditorForm,
  questionId: string,
): QuestionHistoryControls {
  const history = historyOf(form, questionId);
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (history === null) {
      return;
    }
    history.listeners.add(rerender);
    return () => {
      history.listeners.delete(rerender);
    };
  }, [history]);

  return {
    canUndo: history !== null && history.undo.length > 0,
    canRedo: history !== null && history.redo.length > 0,
    undo: () => {
      if (history !== null) {
        apply(form, history, "undo");
      }
    },
    redo: () => {
      if (history !== null) {
        apply(form, history, "redo");
      }
    },
  };
}
