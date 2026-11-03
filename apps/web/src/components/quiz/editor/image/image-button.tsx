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
  onDialogOpenChange?: (open: boolean) => void;
  /** Shows a quiet text button instead of an icon. */
  showLabel?: boolean;
  /** What the image belongs to, in the genitive, e.g. "pytania". */
  target?: string;
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
  onDialogOpenChange,
  showLabel = false,
  target,
}: ImageButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    onDialogOpenChange?.(open);
  }

  const hasImage =
    (image !== null && image !== undefined && image !== "") ||
    (imageUploadId !== null && imageUploadId !== undefined);
  const suffix = target === undefined ? "" : ` do ${target}`;
  const label = hasImage ? `Zmień zdjęcie${suffix}` : `Dodaj zdjęcie${suffix}`;

  return (
    <>
      <Button
        type="button"
        variant={hasImage && !showLabel ? "default" : "ghost"}
        size={showLabel ? "sm" : "icon-sm"}
        className={cn(
          "shrink-0",
          showLabel && "text-muted-foreground hover:text-foreground",
          className,
        )}
        onClick={() => {
          if (!isUploading) {
            handleDialogOpenChange(true);
          }
        }}
        disabled={disabled || isUploading}
        aria-label={label}
        title={showLabel ? undefined : label}
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImageIcon className="size-4" />
        )}
        {showLabel ? (
          <span aria-hidden="true">
            {isUploading
              ? "Przesyłanie…"
              : hasImage
                ? "Zmień zdjęcie"
                : "Zdjęcie"}
          </span>
        ) : null}
      </Button>

      <ImageDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        image={image}
        imageUrl={imageUrl}
        imageUploadId={imageUploadId}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        onImageChange={onImageChange}
        onUpload={onUpload}
        disabled={disabled}
        target={target}
      />
    </>
  );
}
