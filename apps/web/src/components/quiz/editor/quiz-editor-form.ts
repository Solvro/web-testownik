"use client";

import { useForm } from "@tanstack/react-form";
import type {
  AnswerFormData,
  QuestionFormData,
  QuizFormData,
} from "@testownik/core/quiz/schema";
import { quizFormSchema } from "@testownik/core/quiz/schema";
import type { Quiz } from "@testownik/core/quiz/types";
import { toast } from "sonner";

export { createAnswer, createQuestion } from "./quiz-editor-factories";

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

/** `missing` blocks saving; `no-correct` is only a reminder. */
export function questionIssue(question: QuestionFormData) {
  if (
    (question.text.trim() === "" && !hasImage(question)) ||
    question.answers.length === 0 ||
    question.answers.some(
      (answer) => answer.text.trim() === "" && !hasImage(answer),
    )
  ) {
    return "missing";
  }
  if (!question.answers.some((answer) => answer.is_correct)) {
    return "no-correct";
  }
  return null;
}

/**
 * Sets the choice type. Single choice keeps only the first correct answer;
 * the IDs of the answers it unmarks are returned for undoing.
 */
export function withChoiceType(question: QuestionFormData, multiple: boolean) {
  const firstCorrect = question.answers.findIndex((a) => a.is_correct);
  const unmarked = multiple
    ? []
    : question.answers
        .filter((answer, index) => answer.is_correct && index !== firstCorrect)
        .map((answer) => answer.id);
  return {
    question: {
      ...question,
      multiple,
      answers: question.answers.map((answer) =>
        unmarked.includes(answer.id)
          ? { ...answer, is_correct: false }
          : answer,
      ),
    },
    unmarked,
  };
}

/** Changes made by `withChoiceType`, by question ID. */
export type ChoiceChanges = Map<
  string,
  { multiple: boolean; unmarked: string[] }
>;

/** Reverses `withChoiceType` changes, keeping other edits made since. */
export function undoChoiceChanges(
  questions: QuestionFormData[],
  changes: ChoiceChanges,
) {
  return questions.map((question) => {
    const change = changes.get(question.id);
    return change === undefined
      ? question
      : {
          ...question,
          multiple: change.multiple,
          answers: question.answers.map((answer) =>
            change.unmarked.includes(answer.id)
              ? { ...answer, is_correct: true }
              : answer,
          ),
        };
  });
}
