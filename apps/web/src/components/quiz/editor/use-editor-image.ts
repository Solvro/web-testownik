"use client";

import { useRef } from "react";

import { useImagePaste } from "@/hooks/use-image-drag";
import { useImageUpload } from "@/hooks/use-image-upload";

import type { ImageState } from "./image";

export function useEditorImage({
  onChange,
  onUploadStart,
  onUploadEnd,
  canStart,
}: {
  onChange: (state: ImageState) => void;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  /** Checked when a file arrives, also by drop and paste, which no
   * disabled control stops. */
  canStart?: () => boolean;
}) {
  const { upload, isUploading } = useImageUpload();
  const uploadingRef = useRef(false);
  async function onUpload(file: File) {
    if (uploadingRef.current || (canStart !== undefined && !canStart())) {
      return;
    }
    uploadingRef.current = true;
    onUploadStart();
    try {
      await upload(file, (url, id, width, height) => {
        onChange({
          image: url,
          imageUrl: null,
          uploadId: id,
          width: width ?? null,
          height: height ?? null,
        });
      });
    } finally {
      uploadingRef.current = false;
      onUploadEnd();
    }
  }
  const { handlePaste } = useImagePaste((file) => {
    void onUpload(file);
  });
  return { onUpload, isUploading, handlePaste };
}

export function imageUpdates(state: ImageState) {
  return {
    image: state.image,
    image_url: state.imageUrl,
    image_upload: state.uploadId,
    image_width: state.width ?? null,
    image_height: state.height ?? null,
  };
}
