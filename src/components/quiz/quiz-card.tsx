import {
  DownloadIcon,
  PencilIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";

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
            <Button size="sm" asChild>
              <Link href={onOpenPath(quiz)}>Otwórz</Link>
            </Button>
          </ViewTransition>
          <div className="flex gap-1 opacity-80">
            {Boolean(showEdit) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    asChild
                    aria-label="Edytuj quiz"
                  >
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
                    aria-label="Udostępnij quiz"
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
                    aria-label="Pobierz quiz"
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
                  <Button
                    variant="outline"
                    size="icon-sm"
                    asChild
                    aria-label="Szukaj w quizie"
                  >
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
                    aria-label="Usuń quiz"
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
