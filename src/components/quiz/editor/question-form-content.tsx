"use client";

import { CircleHelp, InfoIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { toast } from "sonner";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { AnswerForm } from "@/components/quiz/editor/answer-form";
import { ImageDropZone, ImagePreview } from "@/components/quiz/editor/image";
import type { ImageState } from "@/components/quiz/editor/image";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { KbdShortcut } from "@/components/ui/kbd-shortcut";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useImagePaste } from "@/hooks/use-image-drag";
import type {
  AnswerFormData,
  QuestionFormData,
} from "@/lib/schemas/quiz.schema";
import { cn } from "@/lib/utils";

interface QuestionFormContentProps {
  question: QuestionFormData;
  onUpdate: (updates: Partial<QuestionFormData>) => void;
  isImageUploading: boolean;
  onImageChange: (state: ImageState) => void;
  onUpload: (file: File) => Promise<void>;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  className?: string;
}

function createNewAnswer(order: number): AnswerFormData {
  return {
    id: crypto.randomUUID(),
    order,
    text: "",
    is_correct: false,
    image: null,
    image_url: null,
    image_upload: null,
    image_width: null,
    image_height: null,
  };
}

export function QuestionFormContent({
  question,
  onUpdate,
  isImageUploading,
  onImageChange,
  onUpload,
  onUploadStart,
  onUploadEnd,
  className,
}: QuestionFormContentProps) {
  const { handlePaste } = useImagePaste((file: File) => {
    void onUpload(file);
  });

  const hasExplanation = Boolean(question.explanation?.trim());

  function addAnswer() {
    const newOrder = question.answers.length + 1;
    const newAnswer = createNewAnswer(newOrder);
    onUpdate({ answers: [...question.answers, newAnswer] });
  }

  function updateAnswer(answerId: string, updates: Partial<AnswerFormData>) {
    const updatedAnswers = question.answers.map((a) =>
      a.id === answerId ? { ...a, ...updates } : a,
    );
    onUpdate({ answers: updatedAnswers });
  }

  function removeAnswer(answerId: string) {
    if (question.answers.length <= 1) {
      return;
    }
    const filtered = question.answers.filter((a) => a.id !== answerId);
    const reordered = filtered.map((a, index) => ({ ...a, order: index + 1 }));
    onUpdate({ answers: reordered });
  }

  function toggleCorrectAnswer(answerId: string) {
    if (question.multiple) {
      // Multiple choice: toggle the answer
      const updatedAnswers = question.answers.map((a) =>
        a.id === answerId ? { ...a, is_correct: !a.is_correct } : a,
      );
      onUpdate({ answers: updatedAnswers });
    } else {
      // Single choice: only one can be correct
      const updatedAnswers = question.answers.map((a) => ({
        ...a,
        is_correct: a.id === answerId,
      }));
      onUpdate({ answers: updatedAnswers });
    }
  }

  async function handleFileDrop(file: File) {
    await onUpload(file);
  }

  async function handleAnswerKeyDown(
    answerId: string,
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "v"
    ) {
      event.preventDefault();

      try {
        const text = await navigator.clipboard.readText();
        const lines = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length === 0) {
          return;
        }

        const currentAnswerIndex = question.answers.findIndex(
          (a) => a.id === answerId,
        );
        if (currentAnswerIndex === -1) {
          return;
        }

        const currentAnswer = question.answers[currentAnswerIndex];
        const shouldReplace = !currentAnswer.text.trim();

        if (shouldReplace) {
          const updatedAnswers = [...question.answers];

          updatedAnswers[currentAnswerIndex] = {
            ...updatedAnswers[currentAnswerIndex],
            text: lines[0],
          };

          const remainingLines = lines.slice(1);
          if (remainingLines.length > 0) {
            const newAnswers = remainingLines.map((line) => ({
              ...createNewAnswer(0),
              text: line,
            }));

            updatedAnswers.splice(currentAnswerIndex + 1, 0, ...newAnswers);
          }

          const reordered = updatedAnswers.map((a, index) => ({
            ...a,
            order: index + 1,
          }));

          onUpdate({ answers: reordered });
        } else {
          const newAnswers = lines.map((line) => ({
            ...createNewAnswer(0),
            text: line,
          }));

          const updatedAnswers = [...question.answers];
          updatedAnswers.splice(currentAnswerIndex + 1, 0, ...newAnswers);

          const reordered = updatedAnswers.map((a, index) => ({
            ...a,
            order: index + 1,
          }));
          onUpdate({ answers: reordered });
        }
      } catch (error) {
        console.error("Failed to read clipboard:", error);
        toast.error(
          "Aby wkleić odpowiedzi, musisz włączyć dostęp do schowka w przeglądarce.",
        );
      }
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <ImageDropZone
        onFileDrop={(file) => {
          void onUpload(file);
        }}
        label="Upuść zdjęcie do pytania"
      >
        <div className="space-y-2">
          <Textarea
            placeholder="Treść pytania..."
            value={question.text}
            onChange={(event) => {
              onUpdate({ text: event.target.value });
            }}
            onPaste={(event) => {
              handlePaste(event);
            }}
            rows={2}
            className="resize-none"
          />
          <ImagePreview
            image={question.image}
            imageUrl={question.image_url}
            imageUploadId={question.image_upload}
            imageWidth={question.image_width}
            imageHeight={question.image_height}
            onImageChange={onImageChange}
            onUpload={onUpload}
            onFileDrop={handleFileDrop}
            isUploading={isImageUploading}
            size="medium"
          />

          {hasExplanation ? (
            <Alert>
              <InfoIcon />
              <AlertDescription className="prose line-clamp-5">
                <MarkdownRenderer>{question.explanation}</MarkdownRenderer>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </ImageDropZone>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              Odpowiedzi
            </span>
            <HoverCard openDelay={100} closeDelay={200}>
              <HoverCardTrigger asChild>
                <Button type="button" variant="ghost" size="icon-xs">
                  <CircleHelp className="text-muted-foreground size-4" />
                  <span className="sr-only">Pomoc</span>
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80 space-y-2" align="start">
                <h4 className="text-sm font-semibold">Wskazówki</h4>
                <p className="text-sm">
                  Użyj <KbdShortcut suffix="+ Shift + V" /> podczas wklejania
                  listy odpowiedzi, aby automatycznie rozdzielić je na osobne
                  pola
                </p>
                <p className="text-sm">
                  Aby szybko wstawić zdjęcie, przeciągnij je na pole odpowiedzi
                  lub wklej z schowka - <KbdShortcut suffix="+ V" />
                </p>
              </HoverCardContent>
            </HoverCard>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="ml-auto flex items-center gap-1.5 px-2">
                <Checkbox
                  id={`multiple-${question.id}`}
                  checked={question.multiple}
                  onCheckedChange={(checked) => {
                    onUpdate({ multiple: Boolean(checked) });
                  }}
                />
                <Label
                  htmlFor={`multiple-${question.id}`}
                  className="cursor-pointer text-xs"
                >
                  Multi
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Wielokrotny wybór</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-2">
          {question.answers.map((answer) => (
            <AnswerForm
              key={answer.id}
              answer={answer}
              isMultiple={question.multiple}
              onUpdate={(updates) => {
                updateAnswer(answer.id, updates);
              }}
              onRemove={() => {
                removeAnswer(answer.id);
              }}
              onToggleCorrect={() => {
                toggleCorrectAnswer(answer.id);
              }}
              onUploadStart={onUploadStart}
              onUploadEnd={onUploadEnd}
              canDelete={question.answers.length > 1}
              onKeyDown={(event) => {
                void handleAnswerKeyDown(answer.id, event);
              }}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addAnswer}
            className="h-7 text-xs"
          >
            + Dodaj odpowiedź
          </Button>
        </div>
      </div>
    </div>
  );
}
