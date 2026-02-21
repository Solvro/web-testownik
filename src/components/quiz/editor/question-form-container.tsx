"use client";

import { useState } from "react";

import type { ImageState } from "@/components/quiz/editor/image";
import { QuestionFormContent } from "@/components/quiz/editor/question-form-content";
import { QuestionFormHeader } from "@/components/quiz/editor/question-form-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useImageUpload } from "@/hooks/use-image-upload";
import type { QuestionFormData } from "@/lib/schemas/quiz.schema";
import { cn } from "@/lib/utils";

interface QuestionFormContainerProps {
  question: QuestionFormData;
  onUpdate: (updates: Partial<QuestionFormData>) => void;
  onRemove: () => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  className?: string;
}

export function QuestionFormContainer({
  question,
  onUpdate,
  onRemove,
  onUploadStart,
  onUploadEnd,
  className,
}: QuestionFormContainerProps) {
  const [isImageUploading, setIsImageUploading] = useState(false);

  const { upload } = useImageUpload();

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

  const header = (
    <QuestionFormHeader
      question={question}
      onUpdate={onUpdate}
      onRemove={onRemove}
      isImageUploading={isImageUploading}
      onImageChange={handleImageChange}
      onUpload={handleUpload}
    />
  );

  const content = (
    <QuestionFormContent
      question={question}
      onUpdate={onUpdate}
      isImageUploading={isImageUploading}
      onImageChange={handleImageChange}
      onUpload={handleUpload}
      onUploadStart={onUploadStart}
      onUploadEnd={onUploadEnd}
    />
  );

  return (
    <Card
      id={`question-${question.id}`}
      className={cn("transition-shadow", className)}
    >
      <CardHeader className="pb-0">{header}</CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
