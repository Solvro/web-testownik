"use client";

import type { AnswerFormData } from "@testownik/core/quiz/schema";
import { CheckIcon, XIcon } from "lucide-react";
import type { ClipboardEvent } from "react";

import { MarkdownField } from "@/components/markdown-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { ImageButton, ImageDropZone, ImagePreview } from "./image";
import { hasImage, updateAnswer } from "./quiz-editor-form";
import type { QuizEditorForm } from "./quiz-editor-form";
import { imageUpdates, useEditorImage } from "./use-editor-image";

export function AnswerEditor({
  markdown = true,
  form,
  questionId,
  questionIndex,
  answer,
  answerIndex,
  multiple,
  canDelete,
  disabled,
  onToggleCorrect,
  onEnter,
  onRemove,
  onPasteLines,
  onUploadStart,
  onUploadEnd,
}: {
  /** Whether the question renders Markdown. */
  markdown?: boolean;
  form: QuizEditorForm;
  questionId: string;
  questionIndex: number;
  answer: AnswerFormData;
  answerIndex: number;
  multiple: boolean;
  canDelete: boolean;
  disabled: boolean;
  onToggleCorrect: () => void;
  /** Enter without Shift: add the next answer. */
  onEnter: () => void;
  /** Removes the answer and moves focus to a neighbour. */
  onRemove: () => void;
  /** Returns true when the pasted text was split into several answers. */
  onPasteLines: (event: ClipboardEvent<HTMLTextAreaElement>) => boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
}) {
  const onImageChange = (state: Parameters<typeof imageUpdates>[0]) => {
    updateAnswer(form, questionId, answer.id, imageUpdates(state));
  };
  const { onUpload, isUploading, handlePaste } = useEditorImage({
    onChange: onImageChange,
    onUploadStart,
    onUploadEnd,
  });
  const path =
    `questions[${String(questionIndex)}].answers[${String(answerIndex)}]` as `questions[${number}].answers[${number}]`;
  const imageProps = {
    image: answer.image,
    imageUrl: answer.image_url,
    imageUploadId: answer.image_upload,
    imageWidth: answer.image_width,
    imageHeight: answer.image_height,
    onImageChange,
    onUpload,
    isUploading,
    disabled,
  };
  const number = String(answer.order);
  const withImage = hasImage(answer);

  return (
    <ImageDropZone
      disabled={isUploading || disabled}
      id={`answer-${answer.id}`}
      label="Upuść zdjęcie do odpowiedzi"
      onFileDrop={(file) => {
        void onUpload(file);
      }}
    >
      <form.Field name={path}>
        {(answerField) => (
          <form.Field name={`${path}.text`}>
            {(field) => {
              const invalid =
                field.errors.length > 0 || answerField.errors.length > 0;
              return (
                <>
                  <div
                    data-correct={answer.is_correct}
                    className={cn(
                      "group/answer bg-card flex min-w-0 items-start rounded-lg border transition-[border-color,background-color,box-shadow]",
                      "focus-within:ring-primary focus-within:ring-2",
                      answer.is_correct
                        ? "border-green-600/45 bg-green-500/[0.07] dark:border-green-400/40 dark:bg-green-400/10"
                        : "border-border hover:border-foreground/20 dark:bg-input/20",
                      invalid && "border-destructive",
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={answer.is_correct}
                      aria-label={`Poprawna odpowiedź ${number}`}
                      title={
                        answer.is_correct
                          ? "Poprawna odpowiedź. Kliknij, aby odznaczyć."
                          : "Oznacz jako poprawną"
                      }
                      disabled={disabled}
                      onClick={onToggleCorrect}
                      className="focus-visible:ring-primary flex size-11 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center border-2 transition-colors",
                          multiple ? "rounded-[5px]" : "rounded-full",
                          answer.is_correct
                            ? "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500"
                            : "border-muted-foreground/80 group-hover/answer:border-muted-foreground",
                        )}
                      >
                        {answer.is_correct ? (
                          <CheckIcon className="size-3.5" strokeWidth={3} />
                        ) : null}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <MarkdownField
                        id={`answer-text-${answer.id}`}
                        label={`Odpowiedź ${number}`}
                        placeholder={`Odpowiedź ${number}`}
                        value={field.value}
                        disabled={disabled}
                        invalid={invalid}
                        describedBy={`answer-error-${answer.id}`}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        inputClassName="scroll-mt-32 scroll-mb-4 py-2.5 pr-1 text-base leading-relaxed"
                        minHeight="2.75rem"
                        markdown={markdown}
                        onPaste={(event) => {
                          handlePaste(event);
                          if (!event.defaultPrevented && onPasteLines(event)) {
                            event.preventDefault();
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.nativeEvent.isComposing ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.altKey
                          ) {
                            return;
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            onEnter();
                          } else if (
                            event.key === "Backspace" &&
                            event.currentTarget.value === "" &&
                            !withImage &&
                            canDelete
                          ) {
                            event.preventDefault();
                            onRemove();
                          }
                        }}
                      />
                      <ImagePreview
                        {...imageProps}
                        size="small"
                        className="mb-2.5"
                        onFileDrop={(file) => {
                          void onUpload(file);
                        }}
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 p-1.5 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within/answer:opacity-100 pointer-fine:group-hover/answer:opacity-100">
                      {withImage ? null : (
                        <ImageButton
                          {...imageProps}
                          target={`odpowiedzi ${number}`}
                          className="text-muted-foreground hover:text-foreground"
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Usuń odpowiedź ${number}`}
                        title="Usuń odpowiedź"
                        disabled={!canDelete || isUploading || disabled}
                        onClick={() => {
                          onRemove();
                        }}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  </div>
                  <div id={`answer-error-${answer.id}`} className="pl-11">
                    <FieldError errors={answerField.errors} />
                  </div>
                </>
              );
            }}
          </form.Field>
        )}
      </form.Field>
    </ImageDropZone>
  );
}
