"use client";

import { useForm } from "@tanstack/react-form";
import type {
  AnswerFormData,
  QuestionFormData,
  QuizFormData,
} from "@testownik/core/quiz/schema";
import {
  SINGLE_CHOICE_ERROR,
  questionTypeError,
  quizFormSchema,
} from "@testownik/core/quiz/schema";
import { TRUE_FALSE_LABELS } from "@testownik/core/quiz/types";
import type { QuestionType, Quiz } from "@testownik/core/quiz/types";
import { toast } from "sonner";

import { createAnswer, createTrueFalseAnswers } from "./quiz-editor-factories";

export {
  createAnswer,
  createQuestion,
  createTrueFalseAnswers,
} from "./quiz-editor-factories";

/** The editor's values for a quiz from the API, in question and answer order. */
export function quizToFormData(
  quiz: Pick<Quiz, "title" | "description" | "questions">,
): QuizFormData {
  return {
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions
      .toSorted((a, b) => a.order - b.order)
      .map((question) => ({
        ...question,
        answers: question.answers.toSorted((a, b) => a.order - b.order),
      })),
  };
}

export function useQuizEditorForm(options: {
  defaultValues: QuizFormData;
  /** Resolves with the saved quiz, which carries the IDs the API assigned. */
  onSave: (value: QuizFormData) => Promise<QuizFormData | null>;
  onInvalid: (value: QuizFormData) => void;
}) {
  return useForm({
    defaultValues: options.defaultValues,
    // Check every question on submit. After a failed check, refresh errors when
    // leaving a field, without parsing the whole quiz on each keystroke.
    validators: [
      {
        run: quizFormSchema,
        triggers: [
          { trigger: "blur", when: ({ formApi }) => formApi.state.isInvalid },
        ],
      },
      // A single-choice question with several correct answers comes from a
      // deliberate change, so it is reported at once. A missing correct
      // answer waits for the submit check, like other incomplete input.
      {
        run: ({ value, createErrorMap }) => {
          const errors = createErrorMap();
          for (const [index, question] of value.questions.entries()) {
            if (questionTypeError(question) === SINGLE_CHOICE_ERROR) {
              const field =
                `questions[${String(index)}].answers` as `questions[${number}].answers`;
              errors.fields[field] = SINGLE_CHOICE_ERROR;
            }
          }
          return errors;
        },
        runOnMount: true,
        runOnSubmit: false,
        triggers: ["change"],
      },
    ],
    onSubmitInvalid: ({ value }) => {
      options.onInvalid(value);
    },
    onSubmit: async ({ value, formApi, createValidationError }) => {
      const saved = await options.onSave(value);
      if (saved !== null) {
        // New questions and answers get their IDs from the API. Keeping the
        // temporary ones would make the next save recreate them.
        formApi.reset(saved);
        return;
      }
      return createValidationError({
        form: "Nie udało się zapisać quizu. Spróbuj ponownie.",
        fields: {},
      });
    },
  });
}

export type QuizEditorForm = ReturnType<typeof useQuizEditorForm>;

// Forms with a version restore in flight; its response replaces the quiz.
const restoring = new WeakSet<QuizEditorForm>();

export function setRestoring(form: QuizEditorForm, value: boolean) {
  if (value) {
    restoring.add(form);
  } else {
    restoring.delete(form);
  }
}

/**
 * Whether an action outside the form, such as a toast's Cofnij, may change
 * the quiz now. While a save or a restore is running its response would
 * overwrite the change, so the author is asked to wait instead. Reads the
 * live state, so callbacks created earlier see the current lock.
 */
export function canMutate(form: QuizEditorForm) {
  if (restoring.has(form)) {
    toast.info("Poczekaj na zakończenie przywracania.");
    return false;
  }
  if (form.state.isSubmitting) {
    toast.info("Poczekaj na zakończenie zapisu.");
    return false;
  }
  return true;
}

// Image uploads in flight per form; each writes into the form when done.
const uploading = new WeakMap<QuizEditorForm, number>();

export function setUploading(form: QuizEditorForm, count: number) {
  uploading.set(form, count);
}

/**
 * Whether a version restore may start now. Like `canMutate`, and no upload
 * may be running: finishing after the restore, it would write its image
 * into the restored content. Reads the live state, so a toast's Cofnij
 * created earlier sees uploads started since.
 */
export function canRestore(form: QuizEditorForm) {
  if ((uploading.get(form) ?? 0) > 0) {
    toast.info("Poczekaj na zakończenie przesyłania zdjęć.");
    return false;
  }
  return canMutate(form);
}

/**
 * Field errors are stored by position, so after answers or questions move,
 * an error can sit on the wrong row. Runs the validation again once the
 * form has shown errors.
 */
export function revalidate(form: QuizEditorForm) {
  if (form.state.isInvalid) {
    void form.validate("blur");
  }
}

export function updateQuestion(
  form: QuizEditorForm,
  id: string,
  update: (question: QuestionFormData) => QuestionFormData,
) {
  form.setFieldValue("questions", (questions) =>
    questions.map((question) =>
      question.id === id ? update(question) : question,
    ),
  );
  revalidate(form);
}

export function updateAnswer(
  form: QuizEditorForm,
  questionId: string,
  answerId: string,
  updates: Partial<AnswerFormData>,
) {
  updateQuestion(form, questionId, (question) => ({
    ...question,
    answers: question.answers.map((answer) =>
      answer.id === answerId ? { ...answer, ...updates } : answer,
    ),
  }));
}

function renumber(questions: QuestionFormData[]) {
  return questions.map((question, index) =>
    question.order === index + 1 ? question : { ...question, order: index + 1 },
  );
}

/** Removes a question and returns a function which puts it back. */
export function removeQuestion(form: QuizEditorForm, id: string) {
  const questions = form.getFieldValue("questions");
  const index = questions.findIndex((question) => question.id === id);
  const removed = questions.at(index);
  if (index === -1 || removed === undefined || questions.length <= 1) {
    return null;
  }
  form.setFieldValue(
    "questions",
    renumber(questions.filter((question) => question.id !== id)),
  );
  revalidate(form);
  return () => {
    const current = form.getFieldValue("questions");
    if (current.some((question) => question.id === id)) {
      return;
    }
    form.setFieldValue(
      "questions",
      renumber(current.toSpliced(Math.min(index, current.length), 0, removed)),
    );
    revalidate(form);
  };
}

export function hasImage(item: {
  image?: string | null;
  image_url?: string | null;
  image_upload?: string | null;
}) {
  return [item.image, item.image_url, item.image_upload].some(
    (value) => typeof value === "string" && value !== "",
  );
}

/** Whether the type picks one answer: its correct marks act like radios. */
export function picksOneAnswer(type: QuestionType) {
  return type === "single_choice" || type === "true_false";
}

/**
 * `missing`, `conflict` and `missing-correct` block saving; `no-correct` is
 * only a reminder. Single choice and true/false need exactly one correct
 * answer: `conflict` has several, `missing-correct` none. Multiple choice
 * without any correct answer is `no-correct`. An open question accepts every
 * answer, so it only needs text.
 */
export function questionIssue(question: QuestionFormData) {
  if (
    (question.text.trim() === "" && !hasImage(question)) ||
    question.answers.length === 0 ||
    question.answers.some(
      (answer) => answer.text.trim() === "" && !hasImage(answer),
    ) ||
    (question.type === "true_false" && question.answers.length !== 2)
  ) {
    return "missing";
  }
  if (question.type === "open") {
    return null;
  }
  const correct = question.answers.filter((answer) => answer.is_correct).length;
  if (picksOneAnswer(question.type) && correct > 1) {
    return "conflict";
  }
  if (correct === 0) {
    return picksOneAnswer(question.type) ? "missing-correct" : "no-correct";
  }
  return null;
}

function renumberAnswers(answers: AnswerFormData[]) {
  return answers.map((answer, index) =>
    answer.order === index + 1 ? answer : { ...answer, order: index + 1 },
  );
}

/**
 * Sets the question type and fits the answers to it. Between the choice types
 * the answers are left as they are: a single-choice question with several
 * correct ones shows as a conflict until it is fixed. True/false keeps the
 * first two answers as its labels, or starts with the default ones when they
 * are empty; leaving it drops the default labels, which mean nothing
 * elsewhere. An open question accepts every answer and drops their images.
 */
export function withQuestionType(
  question: QuestionFormData,
  type: QuestionType,
): QuestionFormData {
  if (question.type === type) {
    return question;
  }
  const changed = {
    ...question,
    type,
  };
  if (type === "true_false") {
    const kept = question.answers.slice(0, 2);
    const labels = createTrueFalseAnswers();
    const answers =
      kept.length === 2 && kept.some((answer) => answer.text.trim() !== "")
        ? kept.map((answer, index) => ({
            ...answer,
            order: index + 1,
            text: answer.text.trim() === "" ? labels[index].text : answer.text,
          }))
        : labels;
    const correct = answers.filter((answer) => answer.is_correct).length;
    return {
      ...changed,
      answers: answers.map((answer, index) => ({
        ...answer,
        is_correct: correct === 1 ? answer.is_correct : index === 0,
      })),
    };
  }
  const defaultLabels = new Set<string>(TRUE_FALSE_LABELS);
  const kept =
    question.type === "true_false"
      ? question.answers.filter(
          (answer) =>
            !defaultLabels.has(answer.text.trim()) || hasImage(answer),
        )
      : question.answers;
  if (type === "open") {
    return {
      ...changed,
      answers: renumberAnswers(
        kept.length === 0 ? [createAnswer(1)] : kept,
      ).map((answer) => ({
        ...answer,
        is_correct: true,
        image: null,
        image_url: null,
        image_upload: null,
        image_width: null,
        image_height: null,
      })),
    };
  }
  // Between the choice types the answers stay as they are.
  if (kept === question.answers && kept.length >= 2) {
    return changed;
  }
  // A choice question starts with two answers to fill in.
  const padded = [...kept];
  while (padded.length < 2) {
    padded.push(createAnswer(padded.length + 1));
  }
  return { ...changed, answers: renumberAnswers(padded) };
}

/** Whether two answer lists hold the same answers in the same order. */
function sameAnswers(a: AnswerFormData[], b: AnswerFormData[]) {
  return (
    a.length === b.length &&
    a.every((answer, index) => {
      const other = b[index];
      return (
        answer.id === other.id &&
        answer.order === other.order &&
        answer.text === other.text &&
        answer.is_correct === other.is_correct &&
        answer.image === other.image &&
        answer.image_url === other.image_url &&
        answer.image_upload === other.image_upload
      );
    })
  );
}

/** Previous question types by question ID, for undoing `withQuestionType`. */
export type QuestionTypes = Map<
  string,
  Pick<QuestionFormData, "type" | "answers">
>;

/** The types and answers of the questions, to restore after a bulk change. */
export function rememberQuestionTypes(
  questions: QuestionFormData[],
): QuestionTypes {
  return new Map(
    questions.map((question) => [
      question.id,
      {
        type: question.type,
        answers: question.answers,
      },
    ]),
  );
}

/**
 * Restores question types, keeping other edits made since. The answers come
 * back only for questions whose type change rewrote them.
 */
export function restoreQuestionTypes(
  questions: QuestionFormData[],
  previous: QuestionTypes,
) {
  return questions.map((question) => {
    const before = previous.get(question.id);
    if (before === undefined || before.type === question.type) {
      return question;
    }
    // Repeating the change on the remembered answers tells whether it
    // rewrote them; a change which left them as they were, such as one
    // between the choice types, keeps the edits made since.
    const rewrote = !sameAnswers(
      withQuestionType({ ...question, ...before }, question.type).answers,
      before.answers,
    );
    return {
      ...question,
      type: before.type,
      answers: rewrote ? before.answers : question.answers,
    };
  });
}

/**
 * An answer put back into a question after its type may have changed: an
 * open question accepts it and shows no image.
 */
export function fitAnswerToType(
  answer: AnswerFormData,
  type: QuestionType,
): AnswerFormData {
  return type === "open"
    ? {
        ...answer,
        is_correct: true,
        image: null,
        image_url: null,
        image_upload: null,
        image_width: null,
        image_height: null,
      }
    : answer;
}
