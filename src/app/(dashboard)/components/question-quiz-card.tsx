"use client";

import "katex/dist/katex.min.css";
import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { computeAnswerVariant } from "@/components/quiz/helpers/question-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRandomQuestion } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

interface QuestionQuizCardProps extends React.ComponentProps<typeof Card> {
  isGuest: boolean;
}

export function QuestionQuizCard({
  className,
  isGuest,
  ...props
}: QuestionQuizCardProps): React.JSX.Element {
  const {
    data: questionData,
    isLoading,
    refetch,
    isFetching,
  } = useRandomQuestion(isGuest);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [enableEdit, setEnableEdit] = useState<boolean>(true);
  const [result, setResult] = useState<string | null>(null);

  // Initialize state when new question loads
  useEffect(() => {
    if (questionData !== undefined) {
      setSelectedAnswers([]);
      setEnableEdit(true);
      setResult(null);
    }
  }, [questionData]);

  const toggleAnswer = (answerId: string) => {
    if (!enableEdit) {
      return;
    }
    setSelectedAnswers((previous) =>
      previous.includes(answerId)
        ? previous.filter((id) => id !== answerId)
        : [...previous, answerId],
    );
  };

  const checkAnswers = () => {
    if (questionData === undefined) {
      return;
    }

    let isCorrect = true;

    for (const answer of questionData.answers) {
      const isSelected = selectedAnswers.includes(answer.id);
      if (
        (isSelected && !answer.is_correct) ||
        (!isSelected && answer.is_correct)
      ) {
        isCorrect = false;
      }
    }

    setResult(isCorrect ? "Poprawna odpowiedź!" : "Niepoprawna odpowiedź.");
    setEnableEdit(false);
  };

  if (questionData === undefined) {
    if (isLoading) {
      return (
        <Card
          className={cn("max-h-[80vh] md:max-h-none", className)}
          {...props}
        >
          <div className="flex flex-col gap-4">
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Skeleton className="h-9 w-40" />
            </CardFooter>
          </div>
        </Card>
      );
    }
    return (
      <Card className={className} {...props}>
        <CardHeader>
          <CardTitle>Nie masz żadnych pytań do powtórzenia</CardTitle>
          <CardDescription>
            Po użyciu twojego pierwszego quizu pojawią się tutaj pytania.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-full opacity-0 transition-opacity hover:opacity-100">
          <iframe
            src="https://pointerpointer.com"
            className="h-full w-full rounded-lg"
            title="Pointer Pointer Game"
          ></iframe>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("max-h-[80vh] gap-2 md:max-h-none", className)}
      {...props}
    >
      <ScrollArea className="min-h-0 w-full">
        <div className="flex flex-col gap-4">
          <CardHeader>
            <small className="text-muted-foreground text-xs">
              Powtórz to jeszcze raz:
            </small>
            <ScrollArea className="w-full min-w-0">
              <CardTitle className="mb-1">
                <Markdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {questionData.text}
                </Markdown>
              </CardTitle>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <CardDescription>
              <Link
                href={`/quiz/${questionData.quiz_id}`}
                className="text-muted-foreground hover:text-foreground block text-xs transition-colors"
              >
                {questionData.quiz_title}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {questionData.answers.map((answer) => (
                <button
                  key={answer.id}
                  onClick={() => {
                    toggleAnswer(answer.id);
                  }}
                  disabled={!enableEdit}
                  className={cn(
                    "w-full justify-start rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                    computeAnswerVariant(
                      selectedAnswers.includes(answer.id),
                      Boolean(result),
                      answer.is_correct,
                    ),
                  )}
                >
                  {answer.text}
                </button>
              ))}
            </div>
          </CardContent>
        </div>
      </ScrollArea>
      <CardFooter className="flex flex-col items-start gap-2">
        {result === null ? null : (
          <p
            className={cn(
              "mt-3 text-sm font-medium",
              result.includes("Poprawna")
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {result}
          </p>
        )}
        <div className="flex w-full justify-end">
          {isFetching ? (
            <Button size="sm" variant="outline" disabled>
              <LoaderCircleIcon className="animate-spin" />
              Ładowanie...
            </Button>
          ) : enableEdit ? (
            <Button size="sm" onClick={checkAnswers}>
              Sprawdź odpowiedź
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refetch();
              }}
            >
              Następne pytanie
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
