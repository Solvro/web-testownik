import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { RotateCcwIcon, SparklesIcon, Undo2 } from "lucide-react";
import Link from "next/link";
import { ViewTransition, useEffect } from "react";
import { SiGithub } from "react-icons/si";

import type { AnswerHint } from "@/components/ai/ai-explain-card";
import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { isInputElement, isModalOpen } from "@/components/quiz/helpers/dom";
import { computeAnswerVariant } from "@/components/quiz/helpers/question-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getQuestionAnsweredCount } from "@/lib/session-utils";
import { cn } from "@/lib/utils";
import type { AnswerRecord, Question } from "@/types/quiz";

interface QuestionCardProps {
  quizId: string;
  question: Question | null;
  selectedAnswers: string[];
  setSelectedAnswers: (selectedAnswers: string[]) => void;
  answers: AnswerRecord[];
  questionChecked: boolean;
  nextAction: () => void;
  isQuizFinished: boolean;
  restartQuiz?: () => void;
  togglePreviousQuestion: () => void;
  canGoBack: boolean;
  isHistoryQuestion: boolean;
  answerHints?: AnswerHint[];
}

export function QuestionCard({
  quizId,
  question,
  selectedAnswers,
  setSelectedAnswers,
  answers,
  questionChecked,
  nextAction,
  isQuizFinished,
  restartQuiz,
  togglePreviousQuestion,
  canGoBack,
  isHistoryQuestion,
  answerHints = [],
}: QuestionCardProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleAnswerClick = (answerId: string) => {
    if (questionChecked) {
      return;
    }
    const newSelectedAnswers = [...selectedAnswers];
    const answerIndex = newSelectedAnswers.indexOf(answerId);

    if (question?.multiple === true) {
      if (answerIndex === -1) {
        newSelectedAnswers.push(answerId);
      } else {
        newSelectedAnswers.splice(answerIndex, 1);
      }
    } else {
      if (answerIndex !== -1) {
        newSelectedAnswers.splice(answerIndex, 1);
      }
      if (answerIndex === -1) {
        newSelectedAnswers.splice(0, newSelectedAnswers.length, answerId);
      }
    }

    setSelectedAnswers(newSelectedAnswers);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key >= "1" && event.key <= "9") {
        const target = event.target as HTMLElement;
        if (isInputElement(target)) {
          return;
        }

        if (isModalOpen()) {
          return;
        }

        const answerIndex = Number.parseInt(event.key, 10) - 1;
        if (question !== null && answerIndex < question.answers.length) {
          handleAnswerClick(question.answers[answerIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [question, selectedAnswers, handleAnswerClick]);

  if (isQuizFinished) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Quiz został ukończony</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Gratulacje! Ukończyłeś cały quiz. Aby kontynuować naukę, zresetuj
              swoje postępy.
            </p>
            <DotLottieReact
              src="https://lottie.host/dfccc02f-66a0-41dc-894c-c5f376a1f8dd/nMskjwo4wX.lottie"
              autoplay
            />
            <div className="flex justify-center">
              <ViewTransition name={`quiz-action-${quizId}`} default="h-full">
                <Button variant="outline" onClick={restartQuiz}>
                  <RotateCcwIcon />
                  Uruchom ponownie quiz
                </Button>
              </ViewTransition>
            </div>
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Lub idź się napić piwka, no i odpocznij - zasłużyłeś!
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="bg-primary/10 text-primary inline-flex h-8 w-8 items-center justify-center rounded-full">
                <SparklesIcon className="size-4" />
              </span>
              Podoba Ci się Testownik?
            </CardTitle>
            <CardDescription className="max-w-prose text-sm leading-relaxed">
              Doceń pracę naszego zespołu oraz wesprzyj projekt zostawiając
              gwiazdkę na GitHubie.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <Button
              render={(props) => (
                <Link
                  {...props}
                  href="https://github.com/Solvro/web-testownik"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Otwórz repozytorium Testownik na GitHubie i zostaw gwiazdkę"
                >
                  <SiGithub className="size-4" />
                  Wesprzyj nas gwiazdką
                </Link>
              )}
              className="group w-full"
              variant="outline"
              size="lg"
              nativeButton={false}
            ></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (question == null) {
    return null;
  }

  const isQuestionAnsweredCorrectly =
    questionChecked &&
    question.answers.every((answer) => {
      return answer.is_correct === selectedAnswers.includes(answer.id);
    });

  const answersCount = getQuestionAnsweredCount(
    question.id,
    questionChecked,
    answers,
  );

  return (
    <Card>
      <CardHeader>
        <ScrollArea className="w-full min-w-0">
          <CardTitle className="mb-1 font-medium">
            <div className="inline-flex items-start gap-2">
              <span className="inline-block leading-tight">
                <MarkdownRenderer className="inline-block">
                  {String.raw`${String(question.order)}\. ${question.text}`}
                </MarkdownRenderer>
              </span>
              {question.is_ai_generated === true ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Badge
                        variant="outline"
                        className="border-primary/20 text-primary/70 my-px shrink-0 gap-1 px-1.5 select-none"
                      >
                        <SparklesIcon className="size-3" />
                        AI
                      </Badge>
                    }
                  ></TooltipTrigger>
                  <TooltipContent>
                    To pytanie zostało wygenerowane przez AI
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge
                      variant="secondary"
                      className="my-px shrink-0 select-none"
                    >
                      {answersCount}
                    </Badge>
                  }
                ></TooltipTrigger>
                <TooltipContent>
                  To pytanie pojawiło się{" "}
                  {answersCount === 1
                    ? "pierwszy raz"
                    : `już ${answersCount.toString()} razy`}
                </TooltipContent>
              </Tooltip>
            </div>
          </CardTitle>

          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <CardDescription>
          <ImageLoad
            key={`question-image-${question.id}`}
            url={question.image}
            alt={question.text}
            width={question.image_width}
            height={question.image_height}
            className="mx-auto mt-4 max-h-80 rounded border object-contain"
          />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {question.answers.map((answer, answerIndex) => {
            const hint = answerHints.find((h) => h.answerIndex === answerIndex);
            return (
              <div key={`answer-wrapper-${answer.id}`} className="group/answer">
                <button
                  id={`answer-${answer.id}`}
                  onClick={() => {
                    handleAnswerClick(answer.id);
                  }}
                  disabled={questionChecked}
                  className={cn(
                    "bg-input dark:bg-background focus-visible:ring-ring w-full justify-start rounded-md border px-4 py-3 text-left font-medium wrap-break-word transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
                    computeAnswerVariant(
                      selectedAnswers.includes(answer.id),
                      questionChecked,
                      answer.is_correct,
                    ),
                  )}
                >
                  <MarkdownRenderer className="pointer-events-none w-full text-sm">
                    {answer.text}
                  </MarkdownRenderer>
                  <ImageLoad
                    key={`answer-image-${question.id}-${answer.id}`}
                    url={answer.image}
                    alt={answer.text}
                    width={answer.image_width}
                    height={answer.image_height}
                    className="mx-auto max-h-40 rounded object-contain"
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    hint === undefined
                      ? "grid-rows-[0fr] opacity-0"
                      : "mt-1.5 grid-rows-[1fr] opacity-100",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-primary/10 bg-primary/5 flex items-start gap-2 rounded-lg border px-3 py-2">
                      <SparklesIcon className="text-primary mt-0.5 size-3.5 shrink-0" />
                      <MarkdownRenderer className="text-primary/80 text-xs leading-relaxed">
                        {hint?.hint ?? ""}
                      </MarkdownRenderer>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 min-h-5 text-sm">
          {questionChecked && isQuestionAnsweredCorrectly ? (
            <p className="font-medium text-green-600 dark:text-green-400">
              Poprawna odpowiedź!
            </p>
          ) : questionChecked && selectedAnswers.length === 0 ? (
            <p className="text-destructive font-medium">
              Nie wybrano odpowiedzi
            </p>
          ) : (
            questionChecked && (
              <p className="text-destructive font-medium">
                Niepoprawna odpowiedź.
              </p>
            )
          )}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          {isHistoryQuestion ? (
            <Button variant="outline" onClick={togglePreviousQuestion}>
              Powrót do pytań
            </Button>
          ) : (
            <>
              {canGoBack && !questionChecked ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={togglePreviousQuestion}
                      >
                        <Undo2 />
                      </Button>
                    }
                  ></TooltipTrigger>
                  <TooltipContent>Poprzednie pytanie</TooltipContent>
                </Tooltip>
              ) : null}
              <ViewTransition name={`quiz-action-${quizId}`} default="h-full">
                {questionChecked ? (
                  <Button onClick={nextAction}>Następne pytanie</Button>
                ) : (
                  <Button onClick={nextAction}>Sprawdź odpowiedź</Button>
                )}
              </ViewTransition>
            </>
          )}
        </div>
        {question.explanation != null &&
        question.explanation.trim() !== "" &&
        questionChecked ? (
          <div
            id="explanation"
            className="bg-muted/40 mt-6 max-w-none space-y-2 rounded-md border p-4 text-sm"
          >
            <MarkdownRenderer>{question.explanation}</MarkdownRenderer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
