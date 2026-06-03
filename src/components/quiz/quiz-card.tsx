"use client";

import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
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
import type { ComponentProps } from "react";
import { ViewTransition, useEffect, useRef, useState } from "react";

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
  inFolder = false,
  libraryKey,
  isDraggable = false,
  ...props
}: QuizCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element == null || !isDraggable) {
      return;
    }

    return draggable({
      element,
      getInitialData: () => ({ quizId: quiz.id }),
      onDragStart: () => {
        setIsDragging(true);
      },
      onDrop: () => {
        setIsDragging(false);
      },
    });
  }, [isDraggable, quiz.id]);

  return (
    <ViewTransition
      name={`quiz-open-${libraryKey}-${inFolder ? "folder" : "quiz"}-${quiz.id}`}
    >
      <Link href={onOpenPath(quiz)}>
        <Card
          variant="gradient"
          className={cn(
            "hover:ring-ring relative flex h-full cursor-pointer flex-row justify-between gap-0 px-6 py-5 transition-all select-none hover:ring-2",
            className,
          )}
          ref={ref}
          {...props}
        >
          {isDragging ? (
            <div className="bg-card pointer-events-none absolute inset-0 z-50 rounded-[inherit]" />
          ) : null}
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

          {/*<CardHeader>*/}
          {/*  <CardTitle className="overflow-hidden text-wrap wrap-break-word">*/}
          {/*    {quiz.title}*/}
          {/*  </CardTitle>*/}
          {/*  {quiz.description ? (*/}
          {/*    <CardDescription className="overflow-hidden text-wrap wrap-break-word">*/}
          {/*      {quiz.description}*/}
          {/*    </CardDescription>*/}
          {/*  ) : null}*/}
          {/*</CardHeader>*/}
          {/*<CardFooter className="mt-auto flex items-center justify-between">*/}
          {/*  <ViewTransition name={`quiz-action-${quiz.id}`} default="h-full">*/}
          {/*    {isLoading ? (*/}
          {/*      <div className="relative -left-1 -my-1 inline-flex h-10 overflow-hidden rounded-md border-none p-1">*/}
          {/*        <span className="absolute -inset-full animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--card)_40%,var(--primary)_45%,var(--primary)_59%,var(--card)_60%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,var(--card)_40%,var(--primary)_45%,var(--primary)_59%,var(--card)_60%)]" />*/}
          {/*        <span*/}
          {/*          className={buttonVariants({ size: "sm", className: "z-1" })}*/}
          {/*        >*/}
          {/*          Otwórz*/}
          {/*        </span>*/}
          {/*      </div>*/}
          {/*    ) : (*/}
          {/*      <Button*/}
          {/*        size="sm"*/}
          {/*        disabled={isLoading}*/}
          {/*        nativeButton={false}*/}
          {/*        variant="default"*/}
          {/*        render={(rendererProps) => (*/}
          {/*          <Link*/}
          {/*            {...rendererProps}*/}
          {/*            href={onOpenPath(quiz)}*/}
          {/*            onClick={() => {*/}
          {/*              setIsLoading(true);*/}
          {/*            }}*/}
          {/*          >*/}
          {/*            Otwórz*/}
          {/*          </Link>*/}
          {/*        )}*/}
          {/*      ></Button>*/}
          {/*    )}*/}
          {/*  </ViewTransition>*/}
          {/*  <div className="flex gap-1 opacity-80">*/}
          {/*    {Boolean(showEdit) && (*/}
          {/*      <Tooltip>*/}
          {/*        <TooltipTrigger*/}
          {/*          render={*/}
          {/*            <Button*/}
          {/*              variant="outline"*/}
          {/*              size="icon-sm"*/}
          {/*              aria-label="Edytuj quiz"*/}
          {/*              nativeButton={false}*/}
          {/*              render={(rendererProps) => (*/}
          {/*                <Link {...rendererProps} href={onEditPath(quiz)}>*/}
          {/*                  <PencilIcon />*/}
          {/*                </Link>*/}
          {/*              )}*/}
          {/*            ></Button>*/}
          {/*          }*/}
          {/*        ></TooltipTrigger>*/}
          {/*        <TooltipContent>Edytuj quiz</TooltipContent>*/}
          {/*      </Tooltip>*/}
          {/*    )}*/}
          {/*    {Boolean(showShare) && (*/}
          {/*      <Tooltip>*/}
          {/*        <TooltipTrigger*/}
          {/*          render={*/}
          {/*            <Button*/}
          {/*              variant="outline"*/}
          {/*              size="icon-sm"*/}
          {/*              onClick={() => onShare?.(quiz)}*/}
          {/*              aria-label="Udostępnij quiz"*/}
          {/*            >*/}
          {/*              <ShareIcon />*/}
          {/*            </Button>*/}
          {/*          }*/}
          {/*        ></TooltipTrigger>*/}
          {/*        <TooltipContent>Udostępnij quiz</TooltipContent>*/}
          {/*      </Tooltip>*/}
          {/*    )}*/}
          {/*    {showDownload ? (*/}
          {/*      <Tooltip>*/}
          {/*        <TooltipTrigger*/}
          {/*          render={*/}
          {/*            <Button*/}
          {/*              variant="outline"*/}
          {/*              size="icon-sm"*/}
          {/*              onClick={() => onDownload?.(quiz)}*/}
          {/*              aria-label="Pobierz quiz"*/}
          {/*            >*/}
          {/*              <DownloadIcon />*/}
          {/*            </Button>*/}
          {/*          }*/}
          {/*        ></TooltipTrigger>*/}
          {/*        <TooltipContent>Pobierz quiz</TooltipContent>*/}
          {/*      </Tooltip>*/}
          {/*    ) : null}*/}
          {/*    {Boolean(showSearch) && (*/}
          {/*      <Tooltip>*/}
          {/*        <TooltipTrigger*/}
          {/*          render={*/}
          {/*            <Button*/}
          {/*              variant="outline"*/}
          {/*              size="icon-sm"*/}
          {/*              aria-label="Szukaj w quizie"*/}
          {/*              nativeButton={false}*/}
          {/*              render={(rendererProps) => (*/}
          {/*                <Link {...rendererProps} href={onSearchPath(quiz)}>*/}
          {/*                  <SearchIcon />*/}
          {/*                </Link>*/}
          {/*              )}*/}
          {/*            ></Button>*/}
          {/*          }*/}
          {/*        ></TooltipTrigger>*/}
          {/*        <TooltipContent>Szukaj w quizie</TooltipContent>*/}
          {/*      </Tooltip>*/}
          {/*    )}*/}
          {/*    {Boolean(showDelete) && (*/}
          {/*      <Tooltip>*/}
          {/*        <TooltipTrigger*/}
          {/*          render={*/}
          {/*            <Button*/}
          {/*              variant="outline"*/}
          {/*              size="icon-sm"*/}
          {/*              onClick={() => onDelete?.(quiz)}*/}
          {/*              aria-label="Usuń quiz"*/}
          {/*            >*/}
          {/*              <TrashIcon />*/}
          {/*            </Button>*/}
          {/*          }*/}
          {/*        ></TooltipTrigger>*/}
          {/*        <TooltipContent>Usuń quiz</TooltipContent>*/}
          {/*      </Tooltip>*/}
          {/*    )}*/}
          {/*  </div>*/}
          {/*</CardFooter>*/}
        </Card>
      </Link>
    </ViewTransition>
  );
}
