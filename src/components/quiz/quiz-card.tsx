import {
  DownloadIcon,
  PencilIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
} from "lucide-react";
import React from "react";
import { Link } from "react-router";

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
import { cn } from "@/lib/utils.ts";

import type { QuizMetadata } from "./types.ts";

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

const QuizCard: React.FC<QuizCardProps> = ({
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
}) => {
  return (
    <Card className={cn("flex h-full flex-col", className)} {...props}>
      <CardHeader>
        <CardTitle>{quiz.title}</CardTitle>
        {quiz.description ? (
          <CardDescription>{quiz.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardFooter className="mt-auto flex items-center justify-between">
        <Link to={onOpenPath(quiz)}>
          <Button size="sm">Otwórz</Button>
        </Link>
        <div className="flex gap-1 opacity-80">
          {showEdit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to={onEditPath(quiz)}>
                  <Button variant="outline" size="icon" className="size-8">
                    <PencilIcon />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Edytuj quiz</TooltipContent>
            </Tooltip>
          ) : null}
          {showShare ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => onShare?.(quiz)}
                >
                  <ShareIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Udostępnij quiz</TooltipContent>
            </Tooltip>
          ) : null}
          {showDownload ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => onDownload?.(quiz)}
                >
                  <DownloadIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pobierz quiz</TooltipContent>
            </Tooltip>
          ) : null}
          {showSearch ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to={onSearchPath(quiz)}>
                  <Button variant="outline" size="icon" className="size-8">
                    <SearchIcon />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Szukaj w quizie</TooltipContent>
            </Tooltip>
          ) : null}
          {showDelete ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => onDelete?.(quiz)}
                >
                  <TrashIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Usuń quiz</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
};

export default QuizCard;
