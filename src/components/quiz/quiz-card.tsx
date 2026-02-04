"use client";

import {
  DownloadIcon,
  PencilIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { ViewTransition, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { QuizMetadata } from "@/types/quiz";

export interface QuizCardProps extends React.ComponentProps<typeof Card> {
  quiz: QuizMetadata;
  showEdit?: boolean;
  showShare?: boolean;
  showDownload?: boolean;
  showDelete?: boolean;
  showSearch?: boolean;
  onEditPath?: (quiz: QuizMetadata) => string;
  onOpenPath?: (quiz: QuizMetadata) => string;
  onSearchPath?: (quiz: QuizMetadata) => string;
  onShare?: (quiz: QuizMetadata) => void;
  onDelete?: (quiz: QuizMetadata) => void;
  onDownload?: (quiz: QuizMetadata) => void;
}

export function QuizCard({
  quiz,
  showEdit,
  showShare,
  showDownload = true,
  showDelete,
  showSearch,
  onEditPath = (q) => `/edit-quiz/${q.id}`,
  onOpenPath = (q) => `/quiz/${q.id}`,
  onSearchPath = (q) => `/search-in-quiz/${q.id}`,
  onShare,
  onDelete,
  onDownload,
  className,
  ...props
}: QuizCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <ViewTransition name={`quiz-open-${quiz.id}`}>
      <Card className={cn("flex h-full flex-col", className)} {...props}>
        <CardHeader>
          <CardTitle className="overflow-hidden text-wrap wrap-break-word">
            {quiz.title}
          </CardTitle>
          {quiz.description ? (
            <CardDescription className="overflow-hidden text-wrap wrap-break-word">
              {quiz.description}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardFooter className="mt-auto flex items-center justify-between">
          <ViewTransition name={`quiz-action-${quiz.id}`} default="h-full">
            {isLoading ? (
              <div className="relative -m-1 inline-flex h-10 overflow-hidden rounded-md p-1">
                <span className="absolute inset-[-100%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--card)_40%,var(--primary)_45%,var(--primary)_55%,var(--card)_60%)]" />
                <span className="bg-primary text-primary-foreground inline-flex h-full w-full items-center justify-center rounded-md p-3 text-sm font-medium backdrop-blur-3xl">
                  Otwórz
                </span>
              </div>
            ) : (
              <Button size="sm" asChild disabled={isLoading}>
                <Link
                  href={onOpenPath(quiz)}
                  onClick={() => {
                    setIsLoading(true);
                  }}
                >
                  Otwórz
                </Link>
              </Button>
            )}
          </ViewTransition>
          <div className="flex gap-1 opacity-80">
            {Boolean(showEdit) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" asChild>
                    <Link href={onEditPath(quiz)}>
                      <PencilIcon />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edytuj quiz</TooltipContent>
              </Tooltip>
            )}
            {Boolean(showShare) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onShare?.(quiz)}
                  >
                    <ShareIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Udostępnij quiz</TooltipContent>
              </Tooltip>
            )}
            {showDownload ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onDownload?.(quiz)}
                  >
                    <DownloadIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pobierz quiz</TooltipContent>
              </Tooltip>
            ) : null}
            {Boolean(showSearch) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" asChild>
                    <Link href={onSearchPath(quiz)}>
                      <SearchIcon />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Szukaj w quizie</TooltipContent>
              </Tooltip>
            )}
            {Boolean(showDelete) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onDelete?.(quiz)}
                  >
                    <TrashIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Usuń quiz</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardFooter>
      </Card>
    </ViewTransition>
  );
}
