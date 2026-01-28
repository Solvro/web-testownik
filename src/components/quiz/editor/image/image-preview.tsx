"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { useImageDropTarget } from "@/hooks/use-image-drag";
import { cn } from "@/lib/utils";

import { ImageDialog } from "./image-dialog";
import type { ImageState } from "./image-dialog";

export interface ImagePreviewProps {
  image: string | null | undefined;
  imageUrl: string | null | undefined;
  imageUploadId: string | null | undefined;
  imageWidth?: number | null;
  imageHeight?: number | null;
  onImageChange: (state: ImageState) => void;
  onUpload: (file: File) => Promise<void>;
  onFileDrop?: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  size?: "small" | "medium";
  className?: string;
}

const RENDERED_HEIGHTS = {
  small: 96,
  medium: 160,
};

export function ImagePreview({
  image,
  imageUrl,
  imageUploadId,
  imageWidth,
  imageHeight,
  onImageChange,
  onUpload,
  onFileDrop,
  disabled = false,
  isUploading = false,
  size = "medium",
  className,
}: ImagePreviewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { isDragOver, elementRef } = useImageDropTarget((file) => {
    onFileDrop?.(file);
  }, disabled || isUploading);

  if (image == null || image === "") {
    return null;
  }

  const handleOpenDialog = () => {
    if (!disabled && !isUploading) {
      setDialogOpen(true);
    }
  };

  const heightClass = size === "small" ? "h-24" : "h-40";
  const targetHeight = RENDERED_HEIGHTS[size];

  const targetWidth =
    imageWidth !== null &&
    imageWidth !== undefined &&
    imageHeight !== null &&
    imageHeight !== undefined
      ? Math.round((imageWidth / imageHeight) * targetHeight)
      : undefined;

  const canUseNextImage =
    imageUploadId !== null &&
    imageUploadId !== undefined &&
    imageUploadId !== "" &&
    typeof imageWidth === "number" &&
    typeof imageHeight === "number" &&
    targetWidth !== undefined;

  return (
    <>
      <div
        ref={elementRef}
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        onClick={handleOpenDialog}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpenDialog();
          }
        }}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        className={cn(
          "focus-visible:ring-ring relative inline-flex w-auto cursor-pointer overflow-hidden rounded-lg border transition-all duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
          heightClass,
          isDragOver
            ? "border-primary bg-primary/10 ring-primary/50 ring-2"
            : isHovered && !isUploading
              ? "border-primary/50 scale-[1.01]"
              : "border-border",
          (disabled || isUploading) && "cursor-default",
          disabled && "opacity-50",
          isUploading && "w-32 border-dashed",
          className,
        )}
      >
        {isUploading ? (
          <div className="bg-muted/20 absolute inset-0 flex h-full w-full min-w-24 items-center justify-center">
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <Loader2 className="text-primary size-5 animate-spin" />
              <span className="text-muted-foreground text-xs font-medium">
                Przesyłanie...
              </span>
            </div>
          </div>
        ) : canUseNextImage ? (
          <Image
            src={image}
            alt="Podgląd zdjęcia"
            width={targetWidth}
            height={targetHeight}
            className="bg-muted/10 h-full w-auto object-contain"
            draggable={false}
            unoptimized={false}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={image}
            alt="Podgląd zdjęcia"
            className="bg-muted/10 h-full w-auto object-contain"
            draggable={false}
          />
        )}

        {!isUploading && !disabled && (isHovered || isDragOver) ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center backdrop-blur-[1px] transition-all duration-200",
              isDragOver ? "bg-primary/10" : "bg-black/20",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 shadow-sm transition-all duration-300",
                isDragOver
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/90 text-foreground",
              )}
            >
              <ImageIcon className="size-4" />
              <span className="text-xs font-semibold">
                {isDragOver ? "Upuść aby zmienić" : "Zmień"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

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
