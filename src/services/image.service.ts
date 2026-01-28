import { BaseApiService } from "./base-api.service";
import type { ApiResponse } from "./types";

export interface ImageUploadResponse {
  id: string;
  url: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  width: number;
  height: number;
  uploaded_at: string;
}

export const UPLOAD_ERROR_MESSAGES = {
  FILE_TOO_LARGE: "Plik jest za duży. Maksymalny rozmiar to 10 MB.",
  INVALID_FILE_TYPE:
    "Nieprawidłowy typ pliku. Dozwolone: JPEG, PNG, GIF, WebP, AVIF.",
  NETWORK_ERROR:
    "Błąd połączenia. Sprawdź połączenie internetowe i spróbuj ponownie.",
  UNAUTHORIZED: "Sesja wygasła. Zaloguj się ponownie.",
  SERVER_ERROR: "Błąd serwera. Spróbuj ponownie później.",
  UNKNOWN_ERROR: "Wystąpił nieznany błąd. Spróbuj ponownie.",
  CORRUPTED_IMAGE: "Plik obrazu jest uszkodzony lub nieprawidłowy.",
} as const;

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(
  file: File,
): { valid: true } | { valid: false; error: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: UPLOAD_ERROR_MESSAGES.FILE_TOO_LARGE };
  }

  const isValidType = SUPPORTED_IMAGE_TYPES.includes(
    file.type as (typeof SUPPORTED_IMAGE_TYPES)[number],
  );
  if (!isValidType) {
    return { valid: false, error: UPLOAD_ERROR_MESSAGES.INVALID_FILE_TYPE };
  }

  return { valid: true };
}

export class ImageService extends BaseApiService {
  async upload(file: File): Promise<ApiResponse<ImageUploadResponse>> {
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return this.uploadFile("upload/", file, "image");
  }
}
