"use client";

import type { QuizMetadata } from "@testownik/core/quiz/types";
import { ChevronRightIcon, HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatWhen } from "@/components/quiz/editor/version-history";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useLastUsedQuizzes } from "@/hooks/use-quizzes";

const SKELETON_WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5"];

interface RecentQuizzesDialogProps {
  userId?: string;
}

export function RecentQuizzesDialog({ userId }: RecentQuizzesDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" aria-label="Ostatnio używane">
            <HistoryIcon />
            <span className="hidden sm:inline">Ostatnio używane</span>
          </Button>
        }
      />
      <DialogContent className="flex flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ostatnio używane</DialogTitle>
          <DialogDescription>Twoje ostatnio otwierane quizy.</DialogDescription>
        </DialogHeader>
        <RecentQuizzesList
          userId={userId}
          onNavigate={() => {
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RecentQuizzesList({
  userId,
  onNavigate,
}: {
  userId?: string;
  onNavigate: () => void;
}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useLastUsedQuizzes();

  const quizzes = data?.pages.flatMap((page) => page.results) ?? [];

  const observeSentinel = (node: HTMLElement | null) => {
    if (node === null) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  };

  if (isLoading) {
    return (
      <ul className="-mx-3 flex flex-col" aria-busy="true">
        {SKELETON_WIDTHS.map((width) => (
          <li key={width} className="flex flex-col gap-1.5 px-3 py-2.5">
            <Skeleton className={`h-4 ${width}`} />
            <Skeleton className="h-3 w-24" />
          </li>
        ))}
      </ul>
    );
  }

  if (error != null) {
    return (
      <p className="text-destructive py-6 text-center text-sm">
        Nie udało się wczytać ostatnio używanych quizów.
      </p>
    );
  }

  if (quizzes.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Brak ostatnio używanych quizów</EmptyTitle>
          <EmptyDescription>
            Otwórz dowolny quiz, a pojawi się na tej liście.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="-mx-3 min-h-0 flex-1">
      <ul className="flex flex-col pr-1">
        {quizzes.map((quiz) => (
          <li key={quiz.id}>
            <RecentQuizRow
              quiz={quiz}
              userId={userId}
              onNavigate={onNavigate}
            />
          </li>
        ))}
        {hasNextPage ? (
          <li
            ref={isFetchingNextPage ? undefined : observeSentinel}
            className="flex flex-col gap-1.5 px-3 py-2.5"
            aria-hidden
          >
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-24" />
          </li>
        ) : null}
      </ul>
    </ScrollArea>
  );
}

function RecentQuizRow({
  quiz,
  userId,
  onNavigate,
}: {
  quiz: QuizMetadata;
  userId?: string;
  onNavigate: () => void;
}) {
  const creator =
    quiz.creator != null && quiz.creator.id !== userId
      ? quiz.creator.full_name
      : null;
  const lastUsed =
    quiz.last_used_at === null ? null : formatWhen(quiz.last_used_at);

  return (
    <Link
      href={`/quiz/${quiz.id}`}
      onClick={onNavigate}
      className="group hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none focus-visible:ring-[3px]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{quiz.title}</p>
        {lastUsed !== null || creator !== null ? (
          <p className="text-muted-foreground truncate text-xs">
            {[lastUsed, creator].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}
