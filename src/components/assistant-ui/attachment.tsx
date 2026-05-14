"use client";

import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { FileText, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import { useShallow } from "zustand/shallow";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const useFileSource = (file: File | undefined) => {
  const [source, setSource] = useState<string | undefined>();

  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
  useEffect(() => {
    if (file === undefined) {
      setSource(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSource(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  return source;
};

const useAttachmentSource = () => {
  const { file, src } = useAuiState(
    useShallow((s): { file?: File; src?: string } => {
      if (s.attachment.type !== "image") {
        return {};
      }
      if (s.attachment.file != null) {
        return { file: s.attachment.file };
      }
      const source = s.attachment.content?.find(
        (c) => c.type === "image",
      )?.image;
      if (source == null || source === "") {
        return {};
      }
      return { src: source };
    }),
  );

  return useFileSource(file) ?? src;
};

function AttachmentPreview({ src }: { src: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Attachment preview"
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full object-contain",
        isLoaded
          ? "aui-attachment-preview-image-loaded"
          : "aui-attachment-preview-image-loading invisible",
      )}
      onLoad={() => {
        setIsLoaded(true);
      }}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
function AttachmentPreviewDialog({ children }: PropsWithChildren) {
  const source = useAttachmentSource();

  if (source === undefined) {
    return children;
  }

  return (
    <Dialog>
      <DialogTrigger className="aui-attachment-preview-trigger hover:bg-accent/50 cursor-pointer transition-colors">
        {children}
      </DialogTrigger>
      <DialogContent className="aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&_svg]:text-background [&>button]:hover:[&_svg]:text-destructive p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!">
        <DialogTitle className="aui-sr-only sr-only">
          Image Attachment Preview
        </DialogTitle>
        <div className="aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden">
          <AttachmentPreview src={source} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentThumb() {
  const source = useAttachmentSource();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <AvatarImage
        src={source}
        alt="Attachment preview"
        className="aui-attachment-tile-image object-cover"
      />
      <AvatarFallback>
        <FileText className="aui-attachment-tile-fallback-icon text-muted-foreground size-8" />
      </AvatarFallback>
    </Avatar>
  );
}

function AttachmentRemove() {
  return (
    <AttachmentPrimitive.Remove
      render={
        <TooltipIconButton
          tooltip="Remove file"
          className="aui-attachment-tile-remove text-muted-foreground hover:[&_svg]:text-destructive absolute inset-e-1.5 top-1.5 size-3.5 rounded-full bg-white opacity-100 shadow-sm hover:bg-white! [&_svg]:text-black"
          side="top"
        />
      }
    >
      <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
    </AttachmentPrimitive.Remove>
  );
}

function AttachmentUI() {
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";

  const isImage = useAuiState((s) => s.attachment.type === "image");
  const typeLabel = useAuiState((s) => {
    const type = s.attachment.type;
    switch (type) {
      case "image": {
        return "Image";
      }
      case "document": {
        return "Document";
      }
      case "file": {
        return "File";
      }
      default: {
        return type;
      }
    }
  });

  return (
    <Tooltip>
      <AttachmentPrimitive.Root
        className={cn(
          "aui-attachment-root relative",
          isImage && "aui-attachment-root-composer only:*:first:size-24",
        )}
      >
        <AttachmentPreviewDialog>
          <TooltipTrigger
            render={
              <div
                className="aui-attachment-tile bg-muted size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius)-var(--composer-padding))] border transition-opacity hover:opacity-75"
                role="button"
                tabIndex={0}
                aria-label={`${typeLabel} attachment`}
              />
            }
          >
            <AttachmentThumb />
          </TooltipTrigger>
        </AttachmentPreviewDialog>
        {isComposer ? <AttachmentRemove /> : null}
      </AttachmentPrimitive.Root>
      <TooltipContent side="top">
        <AttachmentPrimitive.Name />
      </TooltipContent>
    </Tooltip>
  );
}

export function UserMessageAttachments() {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments>
        {() => <AttachmentUI />}
      </MessagePrimitive.Attachments>
    </div>
  );
}

export function ComposerAttachments() {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
}

export function ComposerAddAttachment() {
  return (
    <ComposerPrimitive.AddAttachment
      render={
        <TooltipIconButton
          tooltip="Add Attachment"
          side="bottom"
          variant="ghost"
          size="icon"
          className="aui-composer-add-attachment hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-8 rounded-full p-1 text-xs font-semibold"
          aria-label="Add Attachment"
        />
      }
    >
      <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
    </ComposerPrimitive.AddAttachment>
  );
}
