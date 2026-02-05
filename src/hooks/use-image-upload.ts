import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { validateFile } from "@/services/image.service";

export function useImageUpload() {
  const { services } = useContext(AppContext);
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (
    file: File,
    onSuccess: (
      url: string,
      id: string,
      width?: number | null,
      height?: number | null,
    ) => void,
    onError?: () => void,
  ) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      onError?.();
      return;
    }

    setIsUploading(true);
    try {
      const response = await services.image.upload(file);
      onSuccess(
        response.data.url,
        response.data.id,
        response.data.width,
        response.data.height,
      );
    } catch (error) {
      onError?.();
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Wystąpił błąd podczas przesyłania";
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading };
}
