"use client";

import { useDraggable } from "@dnd-kit/react";
import {
  ArchiveIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FileArchive,
  GlobeIcon,
  Link2Icon,
  LockIcon,
  NotepadTextIcon,
  PencilIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { ViewTransition } from "react";
import { toast } from "sonner";

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
import type { QuizMetadata } from "@/types/quiz";
import { AccessLevel } from "@/types/quiz";

export interface QuizCardProps extends ComponentProps<typeof Card> {
  quiz: QuizMetadata;
  showEdit?: boolean;
  showShare?: boolean;
  showDownload?: boolean;
  showDelete?: boolean;
  showSearch?: boolean;
  showArchive?: boolean;
  onEditPath?: (quiz: QuizMetadata) => string;
  onOpenPath?: (quiz: QuizMetadata) => string;
  onSearchPath?: (quiz: QuizMetadata) => string;
  onShare?: (quiz: QuizMetadata) => void;
  onDelete?: (quiz: QuizMetadata) => void;
  onDownload?: (quiz: QuizMetadata) => void;
  onArchive?: (quiz: QuizMetadata) => void;
  inFolder?: boolean;
  libraryKey: string;
  isDraggable?: boolean;
}

export function QuizCard({
  quiz,
  showEdit,
  showShare,
  showDownload = true,
  showDelete,
  showSearch,
  showArchive,
  onEditPath = (q) => `/edit-quiz/${q.id}`,
  onOpenPath = (q) => `/quiz/${q.id}`,
  onSearchPath = (q) => `/search-in-quiz/${q.id}`,
  onShare,
  onDelete,
  onDownload,
  onArchive,
  className,
  libraryKey,
  isDraggable = false,
  ...props
}: QuizCardProps) {
  const router = useRouter();

  const { ref, isDragging } = useDraggable({
    id: quiz.id,
    disabled: !isDraggable || quiz.folder.folder_type === "archive",
    data: {
      quizId: quiz.id,
      type: "quiz",
    },
  });

  return (
    <ViewTransition name={`quiz-open-${quiz.id}-${quiz.folder.id}`}>
      <div
        ref={ref}
        onPointerDown={() => {
          if (quiz.folder.folder_type === "archive") {
            toast.error("Nie można przenosić zarchiwizowanych quizów");
          }
        }}
        className={cn("h-full w-full", isDragging && "opacity-50")}
      >
        <Card
          variant="gradient"
          className={cn(
            "hover:ring-ring relative flex h-full cursor-pointer flex-row justify-between gap-0 px-6 py-5 transition-all select-none hover:ring-2",
            className,
          )}
          onClick={() => {
            if (isDragging) {
              return;
            }
            router.push(onOpenPath(quiz));
          }}
          {...props}
        >
          {/*{isDragging ? (*/}
          {/*  <div className="bg-card pointer-events-none absolute inset-0 z-50 rounded-[inherit]" />*/}
          {/*) : null}*/}
          <div className="flex w-full gap-2">
            <div className="bg-accent flex aspect-square size-14 items-center justify-center rounded-lg">
              {quiz.folder.folder_type === "archive" ? (
                <FileArchive className="text-muted-foreground size-9" />
              ) : (
                <NotepadTextIcon className="text-muted-foreground size-9" />
              )}
            </div>
            <CardHeader className="w-full gap-0! p-0">
              <CardTitle className="w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {quiz.title}
              </CardTitle>
              <CardDescription>
                {(() => {
                  switch (quiz.visibility) {
                    case AccessLevel.PRIVATE: {
                      return (
                        <p className="flex gap-1">
                          <LockIcon className="size-5" /> Prywatne
                        </p>
                      );
                    }
                    case AccessLevel.SHARED: {
                      return (
                        <p className="flex gap-1">
                          <Link2Icon className="size-5" /> Udostępnione
                        </p>
                      );
                    }
                    case AccessLevel.UNLISTED: {
                      return (
                        <p className="flex gap-1">
                          <LockIcon className="size-5" /> Prywatne
                        </p>
                      );
                    }
                    case AccessLevel.PUBLIC: {
                      return (
                        <p className="flex gap-1">
                          <GlobeIcon className="size-5" /> Publiczne
                        </p>
                      );
                    }
                  }
                })()}
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
                    <DropdownMenuItem
                      render={
                        <Link href={onEditPath(quiz)}>
                          <PencilIcon />
                          Edytuj quiz
                        </Link>
                      }
                    ></DropdownMenuItem>
                  )}
                  {Boolean(showShare) && (
                    <DropdownMenuItem onClick={() => onShare?.(quiz)}>
                      <ShareIcon />
                      Udostępnij
                    </DropdownMenuItem>
                  )}
                  {showDownload ? (
                    <DropdownMenuItem onClick={() => onDownload?.(quiz)}>
                      <DownloadIcon />
                      Pobierz
                    </DropdownMenuItem>
                  ) : null}
                  {Boolean(showArchive) && (
                    <DropdownMenuItem onClick={() => onArchive?.(quiz)}>
                      <ArchiveIcon />
                      Archiwizuj
                    </DropdownMenuItem>
                  )}
                  {Boolean(showSearch) && (
                    <DropdownMenuItem
                      render={
                        <Link href={onSearchPath(quiz)}>
                          <SearchIcon />
                          Szukaj w quizie
                        </Link>
                      }
                    ></DropdownMenuItem>
                  )}
                  {Boolean(showDelete) && (
                    <DropdownMenuItem onClick={() => onDelete?.(quiz)}>
                      <TrashIcon />
                      Usuń quiz
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
