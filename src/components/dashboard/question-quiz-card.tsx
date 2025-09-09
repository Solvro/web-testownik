import "katex/dist/katex.min.css";
import { LoaderCircleIcon } from "lucide-react";
import React, { useCallback, useContext, useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Link } from "react-router";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { AppContext } from "@/app-context.ts";
import { computeAnswerVariant } from "@/components/quiz/helpers/question-card.ts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import type { QuestionWithQuizInfo } from "@/services/types.ts";

export function QuestionQuizCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>): React.JSX.Element {
  const appContext = useContext(AppContext);
  const [questionData, setQuestionData] = useState<QuestionWithQuizInfo | null>(
    null,
  );
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [enableEdit, setEnableEdit] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    try {
      const data = await appContext.services.quiz.getRandomQuestion();
      setQuestionData(data);
      setSelectedAnswers([]);
      setEnableEdit(true);
      setResult(null);
    } catch {
      setQuestionData(null);
    } finally {
      setLoading(false);
    }
  }, [appContext]);

  useEffect(() => {
    void fetchQuestion();
  }, [fetchQuestion]);

  const toggleAnswer = (index: number) => {
    if (!enableEdit) {
      return;
    }
    setSelectedAnswers((previous) =>
      previous.includes(index)
        ? previous.filter((index_) => index_ !== index)
        : [...previous, index],
    );
  };

  const checkAnswers = () => {
    if (questionData === null) {
      return;
    }

    let isCorrect = true;

    for (const [index, answer] of questionData.answers.entries()) {
      const isSelected = selectedAnswers.includes(index);
      if ((isSelected && !answer.correct) || (!isSelected && answer.correct)) {
        isCorrect = false;
      }
    }

    setResult(isCorrect ? "Poprawna odpowiedź!" : "Niepoprawna odpowiedź.");
    setEnableEdit(false);
  };

  if (questionData === null) {
    if (loading) {
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
                  {questionData.question}
                </Markdown>
              </CardTitle>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <CardDescription>
              <Link
                to={`/quiz/${questionData.quiz_id}`}
                className="text-muted-foreground hover:text-foreground block text-xs transition-colors"
              >
                {questionData.quiz_title}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {questionData.answers.map((answer, index) => (
                <button
                  key={answer.answer}
                  onClick={() => {
                    toggleAnswer(index);
                  }}
                  disabled={!enableEdit}
                  className={cn(
                    "w-full justify-start rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                    computeAnswerVariant(
                      selectedAnswers.includes(index),
                      Boolean(result),
                      answer.correct,
                    ),
                  )}
                >
                  {answer.answer}
                </button>
              ))}
            </div>
          </CardContent>
        </div>
      </ScrollArea>
      <CardFooter className="flex flex-col items-start gap-2">
        {result !== null && result !== "" ? (
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
        ) : null}
        <div className="flex w-full justify-end">
          {loading ? (
            <Button size="sm" variant="outline" disabled>
              <LoaderCircleIcon className="animate-spin" />
              Ładowanie...
            </Button>
          ) : enableEdit ? (
            <Button size="sm" onClick={checkAnswers}>
              Sprawdź odpowiedź
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={fetchQuestion}>
              Następne pytanie
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
