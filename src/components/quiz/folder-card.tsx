"use client";

import { useDraggable, useDroppable } from "@dnd-kit/react";
import {
  DotIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { ViewTransition } from "react";

import type { LibrarySortKey } from "@/components/quiz/library-sort";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Folder, QuizMetadata } from "@/types/quiz";

export interface FolderCardProps extends ComponentProps<typeof Card> {
  folder: Folder;
  userQuizzes: QuizMetadata[];
  sortKey: LibrarySortKey;
  showEdit?: boolean;
  // showShare?: boolean;
  // showDownload?: boolean;
  showDelete?: boolean;
  // showSearch?: boolean;
  // onEditPath?: (quiz: QuizMetadata) => string;
  // onOpenPath?: (quiz: QuizMetadata) => string;
  // onSearchPath?: (quiz: QuizMetadata) => string;
  // onShare?: (folder: Folder) => void;
  onRename?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
  onOpen?: (folderId: string) => void;
  // onDownload?: (quiz: QuizMetadata) => void;
  libraryKey: string;
  isDraggable?: boolean;
}

export function FolderCard({
  folder,
  userQuizzes,
  sortKey,
  showEdit,
  // showShare,
  // showDownload = true,
  showDelete,
  // showSearch,
  // onEditPath = (q) => `/edit-quiz/${q.id}`,
  // onOpenPath = (q) => `/quiz/${q.id}`,
  // onSearchPath = (q) => `/search-in-quiz/${q.id}`,
  // onShare,
  onRename,
  onDelete,
  onOpen,
  // onDownload,
  className,
  libraryKey,
  isDraggable,
  ...props
}: FolderCardProps) {
  const pluralRules = new Intl.PluralRules("pl-PL");
  const quizFormat = pluralRules.select(folder.quizzes.length);
  const folderFormat = pluralRules.select(folder.subfolders.length);

  const quizForms: Record<Intl.LDMLPluralRule, string> = {
    one: "quiz",
    few: "quizy",
    many: "quizów",
    other: "quizu",
    zero: "quizów",
    two: "quizy",
  };
  const folderForms: Record<Intl.LDMLPluralRule, string> = {
    one: "folder",
    few: "foldery",
    many: "folderów",
    other: "folderu",
    zero: "folderów",
    two: "foldery",
  };

  const { ref: dragRef, isDragging } = useDraggable({
    id: folder.id,
    disabled: isDraggable === false,
    data: {
      folderId: folder.id,
      type: "folder",
    },
  });

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: folder.id,
    disabled: isDraggable === false,
    data: {
      folderId: folder.id,
      type: "folder",
    },
  });

  const isActiveDropZone = isDropTarget && !isDragging;

  return (
    <ViewTransition name={`folder-open-${libraryKey}-${folder.id}`}>
      <div
        ref={(element) => {
          dragRef(element);
          dropRef(element);
        }}
        className={cn(isDragging && "opacity-50 transition-opacity")}
      >
        <Card
          variant="gradient"
          className={cn(
            "hover:ring-ring flex h-full cursor-pointer flex-row justify-between gap-0 px-6 py-5 select-none hover:ring-2",
            "transition-all duration-300 ease-out",

            isActiveDropZone && [
              "ring-primary bg-primary/10 border-primary scale-[1.02] shadow-xl ring-4",
            ],
            className,
          )}
          onClick={() => onOpen?.(folder.id)}
          {...props}
        >
          <div className="flex w-full gap-2">
            <div
              className={cn(
                "bg-accent flex aspect-square size-14 items-center justify-center rounded-lg transition-all duration-300",
                isActiveDropZone && "bg-primary/20 scale-105",
              )}
            >
              {isActiveDropZone ? (
                <FolderOpenIcon className="text-primary size-9" />
              ) : (
                <FolderIcon className="text-muted-foreground size-9 transition-transform duration-300 group-hover:scale-105" />
              )}
            </div>
            <CardHeader className="flex w-full flex-col justify-center gap-0! p-0">
              <CardTitle className="w-full overflow-hidden text-left text-ellipsis whitespace-nowrap">
                {folder.name}
              </CardTitle>
              <CardDescription className="flex items-start gap-0">
                {folder.quizzes.length}{" "}
                {quizForms[quizFormat] || quizForms.many}
                {folder.subfolders.length > 0 && (
                  <>
                    <DotIcon />
                    {String(folder.subfolders.length)}{" "}
                    {folderForms[folderFormat] || folderForms.many}
                  </>
                )}
              </CardDescription>
            </CardHeader>
          </div>
          <div className="flex items-center justify-between">
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              className="inline-flex"
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton={false}
                  render={
                    <EllipsisVerticalIcon className="data-popup-open:bg-ring h-10 cursor-pointer rounded-md" />
                  }
                ></DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {Boolean(showEdit) && (
                    <DropdownMenuItem onClick={() => onRename?.(folder.id)}>
                      <PencilIcon />
                      Zmień nazwę
                    </DropdownMenuItem>
                  )}
                  {Boolean(showDelete) && (
                    <DropdownMenuItem onClick={() => onDelete?.(folder.id)}>
                      <TrashIcon />
                      Usuń Folder
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
        </Card>
      </div>
    </ViewTransition>
  );
}
