"use client";

import { CircleHelp, Info, MessageSquareText, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AnswerForm } from "@/components/quiz/editor/answer-form";
import { ExplanationDialog } from "@/components/quiz/editor/explanation-dialog";
import {
  ImageButton,
  ImageDropZone,
  ImagePreview,
} from "@/components/quiz/editor/image";
import type { ImageState } from "@/components/quiz/editor/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { useImageUpload } from "@/hooks/use-image-upload";
import type {
  AnswerFormData,
  QuestionFormData,
} from "@/lib/schemas/quiz.schema";

interface QuestionFormProps {
  question: QuestionFormData;
  onUpdate: (updates: Partial<QuestionFormData>) => void;
  onRemove: () => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
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

export function QuestionForm({
  question,
  onUpdate,
  onRemove,
  onUploadStart,
  onUploadEnd,
}: QuestionFormProps) {
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const { upload } = useImageUpload();

  const { handlePaste } = useImagePaste((file: File) => {
    void handleUpload(file);
  });

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

  function handleImageChange(state: ImageState) {
    onUpdate({
      image: state.image,
      image_url: state.imageUrl,
      image_upload: state.uploadId,
      image_width: state.width ?? null,
      image_height: state.height ?? null,
    });
  }

  async function handleUpload(file: File) {
    setIsImageUploading(true);
    onUploadStart?.();
    await upload(
      file,
      (url, id, width, height) => {
        handleImageChange({
          image: url,
          uploadId: id,
          imageUrl: null,
          width: width ?? null,
          height: height ?? null,
        });
        onUploadEnd?.();
        setIsImageUploading(false);
      },
      () => {
        handleImageChange({
          image: null,
          uploadId: null,
          imageUrl: null,
        });
        onUploadEnd?.();
        setIsImageUploading(false);
      },
    );
  }

  async function handleFileDrop(file: File) {
    await handleUpload(file);
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
          updateAnswer(answerId, { text: lines[0] });

          const remainingLines = lines.slice(1);
          if (remainingLines.length > 0) {
            const newAnswers = remainingLines.map((line) => ({
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

  // Explanation handling
  function handleExplanationChange(explanation: string) {
    onUpdate({ explanation });
  }

  const hasExplanation = Boolean(question.explanation.trim());

  return (
    <Card id={`question-${question.id}`} className="transition-shadow">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <span className="text-muted-foreground text-sm font-medium">
          Pytanie {question.order}
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
              Aby szybko wstawić zdjęcie, przeciągnij je na pole pytania lub
              wklej z schowka - <KbdShortcut suffix="+ V" />
            </p>
          </HoverCardContent>
        </HoverCard>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <ImageButton
                image={question.image}
                imageUrl={question.image_url}
                imageUploadId={question.image_upload}
                imageWidth={question.image_width}
                imageHeight={question.image_height}
                onImageChange={handleImageChange}
                onUpload={handleUpload}
                isUploading={isImageUploading}
              />
            </TooltipTrigger>
            <TooltipContent>Zarządzaj zdjęciem pytania</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={hasExplanation ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => {
                  setExplanationOpen(true);
                }}
                aria-label={
                  hasExplanation ? "Edytuj wyjaśnienie" : "Dodaj wyjaśnienie"
                }
              >
                <MessageSquareText className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasExplanation ? "Edytuj wyjaśnienie" : "Dodaj wyjaśnienie"}
            </TooltipContent>
          </Tooltip>

          <ExplanationDialog
            open={explanationOpen}
            onOpenChange={setExplanationOpen}
            value={question.explanation}
            onChange={handleExplanationChange}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2">
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

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label="Usuń pytanie"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ImageDropZone
          onFileDrop={(file) => {
            void handleUpload(file);
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
              onImageChange={handleImageChange}
              onUpload={handleUpload}
              onFileDrop={handleFileDrop}
              isUploading={isImageUploading}
              size="medium"
            />

            {hasExplanation ? (
              <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                <Info className="text-muted-foreground size-4 shrink-0" />
                <span className="text-muted-foreground line-clamp-1">
                  {question.explanation}
                </span>
              </div>
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
                    Aby szybko wstawić zdjęcie, przeciągnij je na pole
                    odpowiedzi lub wklej z schowka -{" "}
                    <KbdShortcut suffix="+ V" />
                  </p>
                </HoverCardContent>
              </HoverCard>
            </div>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
