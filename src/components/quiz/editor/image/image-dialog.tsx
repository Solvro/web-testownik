"use client";

import { ImageIcon, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE, SUPPORTED_IMAGE_TYPES } from "@/services/image.service";

import { ImageDropZone } from "./image-drop-zone";

function isSafeImageUrl(value: string): boolean {
  if (value === "") {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export interface ImageState {
  image: string | null;
  imageUrl: string | null;
  uploadId: string | null;
  width?: number | null;
  height?: number | null;
}

export interface ImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: string | null | undefined;
  imageUrl: string | null | undefined;
  imageUploadId: string | null | undefined;
  imageWidth?: number | null;
  imageHeight?: number | null;
  onImageChange: (state: ImageState) => void;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function ImageDialog({
  open,
  onOpenChange,
  ...props
}: ImageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ImageDialogBody
          {...props}
          closeDialog={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ImageDialogBodyProps extends Omit<
  ImageDialogProps,
  "open" | "onOpenChange"
> {
  closeDialog: () => void;
}

function ImageDialogBody({
  image,
  imageUrl,
  imageUploadId,
  imageWidth,
  imageHeight,
  onImageChange,
  onUpload,
  disabled = false,
  closeDialog,
}: ImageDialogBodyProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasImageError, setHasImageError] = useState(false);

  const hasImage = image != null && image !== "";
  const hasUpload =
    imageUploadId !== null &&
    imageUploadId !== undefined &&
    imageUploadId !== "";

  const [urlInput, setUrlInput] = useState(() => {
    // Initialize with imageUrl if it's an external URL (not from upload)
    if (imageUrl != null && imageUrl !== "" && !hasUpload) {
      return imageUrl;
    }
    return "";
  });

  const safeUrl = isSafeImageUrl(urlInput) ? urlInput : null;

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (hasImage && !hasUpload) {
      return "url";
    }
    return "upload";
  });

  const targetHeight = 330;
  const targetWidth =
    imageWidth !== null &&
    imageWidth !== undefined &&
    imageHeight !== null &&
    imageHeight !== undefined
      ? Math.round((imageWidth / imageHeight) * targetHeight)
      : undefined;

  const canUseNextImage =
    typeof imageWidth === "number" &&
    typeof imageHeight === "number" &&
    targetWidth !== undefined;

  const handleUpload = async (file: File) => {
    closeDialog();
    await onUpload(file);
  };

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file !== undefined) {
      void handleUpload(file);
    }
    if (inputRef.current !== null) {
      inputRef.current.value = "";
    }
  }

  function handleRemove() {
    onImageChange({
      image: null,
      imageUrl: null,
      uploadId: null,
    });
    setUrlInput("");
    closeDialog();
  }

  function handleUrlSubmit() {
    const trimmedUrl = urlInput.trim();
    if (trimmedUrl !== "") {
      onImageChange({
        image: trimmedUrl,
        imageUrl: trimmedUrl,
        uploadId: null,
      });
      closeDialog();
    }
  }

  function handleClickUpload() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {hasImage ? "Zarządzaj zdjęciem" : "Dodaj zdjęcie"}
        </DialogTitle>
      </DialogHeader>

      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">
            {hasImage ? "Zmień zdjęcie" : "Prześlij plik"}
          </TabsTrigger>
          <TabsTrigger value="url">Podaj URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div className="h-[330px]">
            <ImageDropZone
              onFileDrop={(file) => void handleUpload(file)}
              className={cn(
                "h-full w-full",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {hasImage && hasUpload ? (
                <div className="group relative h-full w-full overflow-hidden rounded-xl border">
                  {canUseNextImage ? (
                    <Image
                      src={image}
                      alt="Podgląd"
                      width={targetWidth}
                      height={targetHeight}
                      className="h-full w-full object-cover"
                      draggable={false}
                      unoptimized={false}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={image}
                      alt="Podgląd"
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  )}
                  <div
                    onClick={handleClickUpload}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleClickUpload();
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 transition-colors hover:bg-black/20"
                  >
                    <div className="bg-background/90 flex translate-y-2 items-center gap-2 rounded-md px-3 py-2 font-medium opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
                      <ImageIcon className="text-primary size-4" />
                      <span className="text-sm">Kliknij, aby zmienić</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="rounded-full shadow-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemove();
                      }}
                      disabled={disabled}
                      title="Usuń zdjęcie"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={handleClickUpload}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleClickUpload();
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="hover:bg-muted/50 border-muted flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors"
                >
                  <div className="bg-muted rounded-full p-3">
                    <ImageIcon className="text-muted-foreground size-6" />
                  </div>
                  <p className="text-sm font-medium">
                    Kliknij lub przeciągnij zdjęcie tutaj
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Maks. {formatFileSize(MAX_FILE_SIZE)} • JPEG, PNG, GIF,
                    WebP, AVIF
                  </p>
                </div>
              )}
            </ImageDropZone>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="flex h-[330px] flex-col gap-4">
            <div className="bg-muted/10 relative min-h-0 w-full flex-1 overflow-hidden rounded-lg border">
              {hasImage && !hasUpload ? (
                <>
                  {canUseNextImage ? (
                    <Image
                      src={image}
                      alt="Podgląd"
                      width={targetWidth}
                      height={targetHeight}
                      className="h-full w-full object-cover"
                      draggable={false}
                      unoptimized={false}
                    />
                  ) : urlInput === "" ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <p className="text-muted-foreground text-sm">
                        Podaj URL, aby zobaczyć podgląd
                      </p>
                    </div>
                  ) : hasImageError || safeUrl === null ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <p className="text-muted-foreground text-sm">
                        Podaj poprawny URL
                      </p>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={safeUrl}
                      alt="Podgląd"
                      className="h-full w-full object-cover"
                      draggable={false}
                      onError={() => {
                        setHasImageError(true);
                      }}
                    />
                  )}
                  <div className="absolute top-2 right-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="rounded-full shadow-sm"
                      onClick={handleRemove}
                      disabled={disabled}
                      title="Usuń zdjęcie"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground flex h-full flex-col items-center justify-center">
                  <ImageIcon className="mb-2 size-8 opacity-20" />
                  <span className="text-sm">Podgląd zdjęcia</span>
                </div>
              )}
            </div>

            <div className="flex-none space-y-3">
              <Label htmlFor="image-url" className="sr-only">
                URL obrazka
              </Label>
              <div className="flex gap-2">
                <Input
                  id="image-url"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(event) => {
                    setUrlInput(event.target.value);
                    setHasImageError(false);
                  }}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  onClick={handleUrlSubmit}
                  disabled={disabled || urlInput.trim() === ""}
                >
                  {hasImage ? "Zmień" : "Dodaj"}
                </Button>
              </div>
              <p className="text-muted-foreground text-center text-xs">
                Podaj bezpośredni link do obrazka
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
