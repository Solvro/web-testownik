"use client";

import { useSelector } from "@tanstack/react-form";
import { ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ClipboardEvent } from "react";
import { toast } from "sonner";

import {
  MarkdownField,
  MarkdownToolbar,
  MarkdownToolbarProvider,
} from "@/components/markdown-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { moveRovingFocus } from "@/lib/roving-focus";
import { cn } from "@/lib/utils";

import { AnswerEditor } from "./answer-editor";
import { focusField } from "./focus-field";
import { ImageButton, ImageDropZone, ImagePreview } from "./image";
import {
  describePaste,
  insertPastedAnswers,
  joinPastedAnswers,
  splitPastedAnswers,
} from "./paste-answers";
import {
  canMutate,
  createAnswer,
  hasImage,
  undoChoiceChanges,
  updateQuestion,
  withChoiceType,
} from "./quiz-editor-form";
import type { QuizEditorForm } from "./quiz-editor-form";
import { imageUpdates, useEditorImage } from "./use-editor-image";

/** A borderless field which shows its edges on hover and focus. */
const quietField =
  "-mx-2 rounded-lg px-2 transition-[background-color,box-shadow] hover:bg-muted/40 focus-within:bg-transparent focus-within:ring-2 focus-within:ring-primary";

export function QuestionEditor({
  hidden = false,
  keyOf = (id) => id,
  form,
  index,
  questionId,
  count,
  onNext,
  onAdd,
  onRemove,
  onCollapse,
  onUploadStart,
  onUploadEnd,
}: {
  /** Kept mounted while closed, to keep the fields' undo history. */
  hidden?: boolean;
  /** The React key of an answer, stable when saving replaces its ID. */
  keyOf?: (id: string) => string;
  form: QuizEditorForm;
  index: number;
  questionId: string;
  count: number;
  onNext: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onCollapse: () => void;
  onUploadStart: () => void;
  onUploadEnd: () => void;
}) {
  const question = useSelector(form.atom, (state) =>
    state.values.questions.at(index),
  );
  const disabled = useSelector(form.atom, (state) => state.isSubmitting);
  const onImageChange = (state: Parameters<typeof imageUpdates>[0]) => {
    updateQuestion(form, questionId, (current) => ({
      ...current,
      ...imageUpdates(state),
    }));
  };
  const { onUpload, isUploading, handlePaste } = useEditorImage({
    onChange: onImageChange,
    onUploadStart,
    onUploadEnd,
  });
  if (question === undefined) {
    return null;
  }
  const path = `questions[${String(index)}]` as `questions[${number}]`;
  const number = String(index + 1);
  const isLast = index === count - 1;
  const imageProps = {
    image: question.image,
    imageUrl: question.image_url,
    imageUploadId: question.image_upload,
    imageWidth: question.image_width,
    imageHeight: question.image_height,
    onImageChange,
    onUpload,
    isUploading,
    disabled,
  };

  function setMultiple(multiple: boolean) {
    const current = form.getFieldValue(path);
    if (current.multiple === multiple) {
      return;
    }
    const { unmarked } = withChoiceType(current, multiple);
    updateQuestion(
      form,
      questionId,
      (latest) => withChoiceType(latest, multiple).question,
    );
    if (unmarked.length > 0) {
      toast(`Odznaczono poprawne odpowiedzi: ${String(unmarked.length)}`, {
        description: "Jednokrotny wybór pozwala na jedną poprawną odpowiedź.",
        duration: 10_000,
        action: {
          label: "Cofnij",
          onClick: () => {
            if (!canMutate(form)) {
              return;
            }
            form.setFieldValue("questions", (questions) =>
              undoChoiceChanges(
                questions,
                new Map([
                  [questionId, { multiple: current.multiple, unmarked }],
                ]),
              ),
            );
          },
        },
      });
    }
  }

  function toggleCorrect(answerId: string) {
    updateQuestion(form, questionId, (current) => ({
      ...current,
      answers: current.answers.map((answer) => ({
        ...answer,
        is_correct:
          answer.id === answerId
            ? !answer.is_correct
            : current.multiple && answer.is_correct,
      })),
    }));
  }

  function addAnswer(afterId?: string) {
    const created = createAnswer(0);
    updateQuestion(form, questionId, (current) => {
      const position =
        afterId === undefined
          ? current.answers.length
          : current.answers.findIndex((answer) => answer.id === afterId) + 1;
      return {
        ...current,
        answers: current.answers
          .toSpliced(position, 0, created)
          .map((answer, order) => ({ ...answer, order: order + 1 })),
      };
    });
    focusField(`answer-text-${created.id}`);
  }

  function removeAnswer(answerId: string) {
    const answers = form.getFieldValue(`${path}.answers`);
    const position = answers.findIndex((answer) => answer.id === answerId);
    const removed = answers.at(position);
    if (position === -1 || removed === undefined) {
      return;
    }
    const neighbour =
      position > 0 ? answers.at(position - 1) : answers.at(position + 1);
    updateQuestion(form, questionId, (current) => ({
      ...current,
      answers: current.answers
        .filter((answer) => answer.id !== answerId)
        .map((answer, order) => ({ ...answer, order: order + 1 })),
    }));
    // The removed row held focus, so continue in the nearest answer.
    if (neighbour === undefined) {
      document.querySelector<HTMLElement>(`#add-answer-${questionId}`)?.focus();
    } else {
      focusField(`answer-text-${neighbour.id}`);
    }
    if (removed.text.trim() === "" && !hasImage(removed)) {
      return;
    }
    toast(`Usunięto odpowiedź ${String(position + 1)}`, {
      duration: 10_000,
      action: {
        label: "Cofnij",
        onClick: () => {
          if (!canMutate(form)) {
            return;
          }
          updateQuestion(form, questionId, (current) =>
            current.answers.some((answer) => answer.id === answerId)
              ? current
              : {
                  ...current,
                  answers: current.answers
                    .toSpliced(
                      Math.min(position, current.answers.length),
                      0,
                      removed,
                    )
                    .map((answer, order) => ({ ...answer, order: order + 1 })),
                },
          );
          focusField(`answer-text-${answerId}`);
        },
      },
    });
  }

  function pasteLines(
    answerId: string,
    event: ClipboardEvent<HTMLTextAreaElement>,
  ) {
    const textarea = event.currentTarget;
    const text = event.clipboardData.getData("text/plain");
    const lines =
      textarea.selectionStart === 0 &&
      textarea.selectionEnd === textarea.value.length
        ? splitPastedAnswers(text)
        : null;
    if (lines === null) {
      return false;
    }
    const before = form.getFieldValue(`${path}.answers`);
    updateQuestion(form, questionId, (current) =>
      insertPastedAnswers(current, answerId, lines),
    );
    const after = form.getFieldValue(`${path}.answers`);
    const paste = describePaste(before, after, answerId, text);
    const last = after.at(
      after.findIndex((answer) => answer.id === answerId) + lines.length - 1,
    );
    if (last !== undefined) {
      focusField(`answer-text-${last.id}`);
    }
    toast.success(`Wklejono odpowiedzi: ${String(lines.length)}`, {
      duration: 10_000,
      action: {
        label: "Wklej jako jedną",
        onClick: () => {
          if (!canMutate(form)) {
            return;
          }
          // Reverse only the split, keeping edits made since the paste.
          updateQuestion(form, questionId, (current) =>
            joinPastedAnswers(current, paste),
          );
          focusField(`answer-text-${answerId}`);
        },
      },
    });
    return true;
  }

  const hasCorrect = question.answers.some((answer) => answer.is_correct);
  const questionImage = hasImage(question);

  return (
    <MarkdownToolbarProvider>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Captures the next-question shortcut from the fields inside. */}
      <article
        hidden={hidden}
        data-testid="question-editor"
        aria-label={`Pytanie ${number}`}
        className="bg-card border-primary/60 ring-primary/15 scroll-mt-20 rounded-xl border ring-3"
        onKeyDown={(event) => {
          // Ignore keys from menus and dialogs portalled out of the card.
          if (
            event.nativeEvent.isComposing ||
            !event.currentTarget.contains(event.target as Node)
          ) {
            return;
          }
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            onCollapse();
            return;
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (isLast) {
              onAdd();
            } else {
              onNext();
            }
          }
        }}
      >
        <header className="bg-card/95 supports-backdrop-filter:bg-card/80 border-border z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-xl border-b px-3 py-2.5 supports-backdrop-filter:backdrop-blur-md sm:sticky sm:top-14 sm:px-4">
          <h2
            aria-label={`Pytanie ${number}`}
            className="w-7 shrink-0 font-semibold tabular-nums sm:ml-1"
          >
            {number}
          </h2>
          <div className="order-last flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:order-none sm:w-auto sm:flex-1">
            <MarkdownToolbar
              disabled={disabled}
              className="bg-muted/60 dark:bg-input/30 rounded-lg p-0.5"
            />
            {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- Focus goes to the checked radio inside. */}
            <div
              role="radiogroup"
              aria-label="Typ wyboru"
              className="bg-muted/60 dark:bg-input/30 inline-flex rounded-lg p-0.5"
              onKeyDown={(event) => {
                const item = moveRovingFocus(
                  event,
                  "[role=radio]",
                  "horizontal",
                );
                if (item === null) {
                  return;
                }
                // Radio buttons select as focus moves.
                setMultiple(item.dataset.multiple === "true");
              }}
            >
              {[false, true].map((multiple) => (
                <button
                  key={String(multiple)}
                  type="button"
                  role="radio"
                  data-multiple={String(multiple)}
                  aria-checked={question.multiple === multiple}
                  tabIndex={question.multiple === multiple ? 0 : -1}
                  title={
                    multiple
                      ? "Można zaznaczyć kilka poprawnych odpowiedzi"
                      : "Tylko jedna odpowiedź jest poprawna"
                  }
                  disabled={disabled}
                  onClick={() => {
                    setMultiple(multiple);
                  }}
                  className={cn(
                    "focus-visible:outline-primary rounded-md px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:outline-2 pointer-coarse:py-2",
                    question.multiple === multiple
                      ? "bg-background text-foreground dark:bg-card shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {multiple ? "Wielokrotny" : "Jednokrotny"}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-0.5 sm:ml-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive pointer-coarse:size-10"
              aria-label={`Usuń pytanie ${number}`}
              title="Usuń pytanie"
              disabled={disabled || count <= 1 || isUploading}
              onClick={onRemove}
            >
              <Trash2Icon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground pointer-coarse:size-10"
              aria-label={`Zwiń pytanie ${number}`}
              aria-expanded
              aria-keyshortcuts="Escape"
              data-question-toggle
              title="Zwiń (Esc)"
              onClick={onCollapse}
            >
              <ChevronUpIcon />
            </Button>
          </div>
        </header>

        <div className="space-y-5 px-4 pt-5 pb-6 sm:pr-6 sm:pl-15">
          <ImageDropZone
            disabled={isUploading || disabled}
            label="Upuść zdjęcie do pytania"
            onFileDrop={(file) => {
              void onUpload(file);
            }}
          >
            <form.Field name={path}>
              {(questionField) => (
                <form.Field name={`${path}.text`}>
                  {(field) => {
                    const invalid =
                      field.errors.length > 0 ||
                      questionField.errors.length > 0;
                    return (
                      <>
                        <div
                          className={cn(
                            quietField,
                            "group/question flex items-start",
                            invalid && "ring-destructive/40 ring-3",
                          )}
                        >
                          <MarkdownField
                            id={`question-text-${questionId}`}
                            label={`Treść pytania ${number}`}
                            placeholder="Wpisz treść pytania"
                            value={field.value}
                            disabled={disabled}
                            invalid={invalid}
                            describedBy={`question-error-${questionId}`}
                            onChange={field.handleChange}
                            onBlur={field.handleBlur}
                            onPaste={handlePaste}
                            className="flex-1"
                            minHeight="2.5rem"
                            inputClassName="scroll-mt-32 scroll-mb-4 py-1.5 text-lg leading-relaxed sm:text-xl"
                          />
                          {questionImage ? null : (
                            // Each field has its own image button, which
                            // shows when the field is hovered or focused.
                            <ImageButton
                              {...imageProps}
                              target="pytania"
                              className="text-muted-foreground hover:text-foreground mt-1.5 shrink-0 transition-opacity pointer-fine:opacity-60 pointer-fine:group-focus-within/question:opacity-100 pointer-fine:group-hover/question:opacity-100"
                            />
                          )}
                        </div>
                        <ImagePreview
                          {...imageProps}
                          size="medium"
                          className="mt-2"
                          onFileDrop={(file) => {
                            void onUpload(file);
                          }}
                        />
                        <div id={`question-error-${questionId}`}>
                          <FieldError errors={questionField.errors} />
                        </div>
                      </>
                    );
                  }}
                </form.Field>
              )}
            </form.Field>
          </ImageDropZone>

          <section
            aria-label={`Odpowiedzi do pytania ${number}`}
            className="space-y-2"
          >
            {hasCorrect ? null : (
              <p className="text-muted-foreground text-sm">
                {question.multiple
                  ? "Zaznacz kwadraty przy poprawnych odpowiedziach."
                  : "Zaznacz kółko przy poprawnej odpowiedzi."}
              </p>
            )}
            <div className="space-y-2">
              {question.answers.map((answer, answerIndex) => (
                <AnswerEditor
                  key={keyOf(answer.id)}
                  form={form}
                  questionId={questionId}
                  questionIndex={index}
                  answer={answer}
                  answerIndex={answerIndex}
                  multiple={question.multiple}
                  canDelete={question.answers.length > 1}
                  disabled={disabled}
                  onToggleCorrect={() => {
                    toggleCorrect(answer.id);
                  }}
                  onEnter={() => {
                    const isLastAnswer =
                      answerIndex === question.answers.length - 1;
                    if (isLastAnswer && answer.text.trim() === "") {
                      return;
                    }
                    const next = question.answers.at(answerIndex + 1);
                    if (next?.text === "") {
                      focusField(`answer-text-${next.id}`);
                    } else {
                      addAnswer(answer.id);
                    }
                  }}
                  onRemove={() => {
                    removeAnswer(answer.id);
                  }}
                  onPasteLines={(event) => pasteLines(answer.id, event)}
                  onUploadStart={onUploadStart}
                  onUploadEnd={onUploadEnd}
                />
              ))}
            </div>
            <Button
              id={`add-answer-${questionId}`}
              type="button"
              variant="ghost"
              className="text-primary hover:text-primary -ml-1 px-2"
              disabled={disabled}
              onClick={() => {
                addAnswer();
              }}
            >
              <PlusIcon />
              Dodaj odpowiedź
            </Button>
          </section>

          <form.Field name={`${path}.explanation`}>
            {(field) => (
              <div className="bg-muted/50 dark:bg-input/20 focus-within:ring-primary flex flex-col gap-x-1.5 rounded-lg px-4 py-2.5 text-sm transition-shadow focus-within:ring-2 sm:flex-row sm:items-start">
                <label
                  htmlFor={`explanation-${questionId}`}
                  className="shrink-0 py-0.5 leading-relaxed font-semibold"
                >
                  Wyjaśnienie
                  <span
                    className="text-muted-foreground hidden font-normal sm:inline"
                    aria-hidden="true"
                  >
                    {" ·"}
                  </span>
                </label>
                <MarkdownField
                  id={`explanation-${questionId}`}
                  label={`Wyjaśnienie pytania ${number}`}
                  placeholder="Opcjonalne, pokazywane po sprawdzeniu odpowiedzi"
                  value={field.value ?? ""}
                  disabled={disabled}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  className="flex-1"
                  inputClassName="scroll-mt-32 scroll-mb-4 py-0.5 text-base leading-relaxed sm:text-sm"
                />
              </div>
            )}
          </form.Field>
        </div>
      </article>
    </MarkdownToolbarProvider>
  );
}
