"use client";

import { CircleHelp, MessageSquareText, Trash2 } from "lucide-react";
import { useState } from "react";

import { ExplanationDialog } from "@/components/quiz/editor/explanation-dialog";
import { ImageButton } from "@/components/quiz/editor/image";
import type { ImageState } from "@/components/quiz/editor/image";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { KbdShortcut } from "@/components/ui/kbd-shortcut";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { QuestionFormData } from "@/lib/schemas/quiz.schema";
import { cn } from "@/lib/utils";

interface QuestionFormHeaderProps {
  question: QuestionFormData;
  onUpdate: (updates: Partial<QuestionFormData>) => void;
  onRemove?: () => void;
  isImageUploading: boolean;
  onImageChange: (state: ImageState) => void;
  onUpload: (file: File) => Promise<void>;
  className?: string;
  hideDelete?: boolean;
}

export function QuestionFormHeader({
  question,
  onUpdate,
  onRemove,
  isImageUploading,
  onImageChange,
  onUpload,
  className,
  hideDelete = false,
}: QuestionFormHeaderProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const hasExplanation = Boolean(question.explanation?.trim());

  function handleExplanationChange(explanation: string) {
    onUpdate({ explanation });
  }

  return (
    <div
      className={cn(
        "flex flex-row items-center gap-2 space-y-0 pb-2",
        className,
      )}
    >
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
            Aby szybko wstawić zdjęcie, przeciągnij je na pole pytania lub wklej
            z schowka - <KbdShortcut suffix="+ V" />
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
              onImageChange={onImageChange}
              onUpload={onUpload}
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
          value={question.explanation ?? ""}
          onChange={handleExplanationChange}
        />

        {!hideDelete && (
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
        )}
      </div>
    </div>
  );
}
