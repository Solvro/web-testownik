"use client";

import { ImageIcon } from "lucide-react";
import React from "react";

import { useImageDropTarget } from "@/hooks/use-image-drag";
import { cn } from "@/lib/utils";

export interface ImageDropZoneProps {
  onFileDrop: (file: File) => void;
  className?: string;
  children: React.ReactNode | ((isDragOver: boolean) => React.ReactNode);
  label?: string;
}

export function ImageDropZone({
  onFileDrop,
  className,
  children,
  label = "Upuść zdjęcie tutaj",
}: ImageDropZoneProps) {
  const { isDragOver, elementRef } = useImageDropTarget(onFileDrop);

  return (
    <div
      ref={elementRef}
      className={cn(
        "relative rounded-lg ring-2 ring-transparent ring-offset-3 transition-all duration-200",
        isDragOver && "ring-primary/30 ring-2",
        className,
      )}
    >
      {isDragOver ? (
        <div className="bg-primary/5 absolute -inset-2 z-50 flex items-center justify-center rounded-2xl">
          <div className="bg-primary text-primary-foreground flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg">
            <ImageIcon className="size-4" />
            <span>{label}</span>
          </div>
        </div>
      ) : null}
      {typeof children === "function" ? children(isDragOver) : children}
    </div>
  );
}
