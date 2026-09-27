"use client";

import {
  dropTargetForExternal,
  monitorForExternal,
} from "@atlaskit/pragmatic-drag-and-drop/external/adapter";
import {
  containsFiles,
  getFiles,
} from "@atlaskit/pragmatic-drag-and-drop/external/file";
import { preventUnhandled } from "@atlaskit/pragmatic-drag-and-drop/prevent-unhandled";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { UPLOAD_ERROR_MESSAGES } from "@/services/image.service";

export function useImageDropTarget(
  onDropImage: (file: File) => void,
  disabled = false,
) {
  const [isDragOver, setIsDragOver] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (element === null || disabled) {
      return;
    }

    return dropTargetForExternal({
      element,
      canDrop: containsFiles,
      onDragEnter: () => {
        setIsDragOver(true);
      },
      onDragLeave: () => {
        setIsDragOver(false);
      },
      onDrop: ({ source }) => {
        setIsDragOver(false);
        const files = getFiles({ source });
        const imageFile = files.find((f) => f.type.startsWith("image/"));
        if (imageFile !== undefined) {
          onDropImage(imageFile);
        } else if (files.length > 0) {
          toast.error(UPLOAD_ERROR_MESSAGES.INVALID_FILE_TYPE);
        }
      },
    });
  }, [onDropImage, disabled]);

  return { isDragOver, elementRef };
}

export function useGlobalFileDragMonitor() {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return monitorForExternal({
      canMonitor: containsFiles,
      onDragStart: () => {
        preventUnhandled.start();

        setIsDragging(true);
      },
      onDrop: () => {
        setIsDragging(false);
      },
    });
  }, []);

  return { isDragging };
}

export function useImagePaste(onPasteImage: (file: File) => void) {
  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file !== null) {
          event.preventDefault();
          onPasteImage(file);
          return;
        }
      }
    }
  };

  return { handlePaste };
}
