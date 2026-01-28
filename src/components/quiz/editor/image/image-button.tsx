"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ImageDialog } from "./image-dialog";
import type { ImageState } from "./image-dialog";

export interface ImageButtonProps {
  image: string | null | undefined;
  imageUrl: string | null | undefined;
  imageUploadId: string | null | undefined;
  imageWidth?: number | null;
  imageHeight?: number | null;
  onImageChange: (state: ImageState) => void;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  className?: string;
  isUploading?: boolean;
}

export function ImageButton({
  image,
  imageUrl,
  imageUploadId,
  imageWidth,
  imageHeight,
  onImageChange,
  onUpload,
  disabled = false,
  className,
  isUploading = false,
}: ImageButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasImage =
    (image !== null && image !== undefined && image !== "") ||
    (imageUploadId !== null && imageUploadId !== undefined);

  return (
    <>
      <Button
        type="button"
        variant={hasImage ? "secondary" : "ghost"}
        size="icon"
        className={cn("size-8 shrink-0", className)}
        onClick={() => {
          if (!isUploading) {
            setDialogOpen(true);
          }
        }}
        disabled={disabled || isUploading}
        aria-label={hasImage ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImageIcon className="size-4" />
        )}
      </Button>

      <ImageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        image={image}
        imageUrl={imageUrl}
        imageUploadId={imageUploadId}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        onImageChange={onImageChange}
        onUpload={onUpload}
        disabled={disabled}
      />
    </>
  );
}
