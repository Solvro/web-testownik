"use client";

import { CheckIcon, Trash2 } from "lucide-react";

import {
  ImageButton,
  ImageDropZone,
  ImagePreview,
  useImagePaste,
} from "@/components/quiz/editor/image";
import type { ImageState } from "@/components/quiz/editor/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "@/hooks/use-image-upload";
import type { AnswerFormData } from "@/lib/schemas/quiz.schema";
import { cn } from "@/lib/utils";

interface AnswerFormProps {
  answer: AnswerFormData;
  isMultiple: boolean;
  onUpdate: (updates: Partial<AnswerFormData>) => void;
  onRemove: () => void;
  onToggleCorrect: () => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  canDelete: boolean;
}

export function AnswerForm({
  answer,
  isMultiple,
  onUpdate,
  onRemove,
  onToggleCorrect,
  onUploadStart,
  onUploadEnd,
  canDelete,
}: AnswerFormProps) {
  function handleImageChange(state: ImageState) {
    onUpdate({
      image: state.image,
      image_url: state.imageUrl,
      image_upload: state.uploadId,
      image_width: state.width ?? null,
      image_height: state.height ?? null,
    });
  }

  const { upload, isUploading: isImageUploading } = useImageUpload();

  const { handlePaste } = useImagePaste((file) => {
    void handleUpload(file);
  });

  async function handleUpload(file: File) {
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
      },
      () => {
        handleImageChange({
          image: null,
          uploadId: null,
          imageUrl: null,
        });
        onUploadEnd?.();
      },
    );
  }

  function handleFileDrop(file: File) {
    void handleUpload(file);
  }

  return (
    <ImageDropZone
      id={`answer-${answer.id}`}
      onFileDrop={handleFileDrop}
      label="Upuść zdjęcie"
      className="rounded-md"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCorrect}
            className={cn(
              "flex size-5 shrink-0 items-center justify-center border-2 text-white transition-all duration-300",
              isMultiple ? "rounded" : "rounded-full",
              answer.is_correct
                ? "border-green-500 bg-green-500"
                : "border-muted-foreground/30 hover:border-muted-foreground/50",
            )}
            aria-label={
              answer.is_correct
                ? "Oznacz jako niepoprawną"
                : "Oznacz jako poprawną"
            }
          >
            {answer.is_correct ? <CheckIcon strokeWidth={3} /> : null}
          </button>

          <Input
            placeholder={`Odpowiedź ${String(answer.order)}...`}
            value={answer.text}
            onChange={(event) => {
              onUpdate({ text: event.target.value });
            }}
            onPaste={(event) => {
              handlePaste(event);
            }}
            className="flex-1"
          />

          <ImageButton
            image={answer.image}
            imageUrl={answer.image_url}
            imageUploadId={answer.image_upload}
            imageWidth={answer.image_width}
            imageHeight={answer.image_height}
            onImageChange={handleImageChange}
            onUpload={handleUpload}
            isUploading={isImageUploading}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive size-8"
            onClick={onRemove}
            disabled={!canDelete}
            aria-label="Usuń odpowiedź"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="pl-7">
          <ImagePreview
            image={answer.image}
            imageUrl={answer.image_url}
            imageUploadId={answer.image_upload}
            imageWidth={answer.image_width}
            imageHeight={answer.image_height}
            onImageChange={handleImageChange}
            onUpload={handleUpload}
            onFileDrop={handleFileDrop}
            isUploading={isImageUploading}
            size="small"
          />
        </div>
      </div>
    </ImageDropZone>
  );
}
