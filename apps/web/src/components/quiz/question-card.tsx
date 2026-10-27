import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { gradeResponse } from "@testownik/core/quiz/grading";
import { getQuestionAnsweredCount } from "@testownik/core/quiz/session";
import type { AnswerRecord, Question } from "@testownik/core/quiz/types";
import { RotateCcwIcon, SparklesIcon, Undo2 } from "lucide-react";
import Link from "next/link";
import { ViewTransition, useEffect } from "react";
import { SiGithub } from "react-icons/si";

import type { AnswerHint } from "@/components/ai/ai-explain-card";
import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ChoiceAnswers } from "@/components/quiz/answers/choice-answers";
import { OpenAnswer } from "@/components/quiz/answers/open-answer";
import { isInputElement, isModalOpen } from "@/components/quiz/helpers/dom";
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

interface QuestionCardProps {
  quizId: string;
  question: Question | null;
  /** Selected answer IDs, or the typed text of an open question. */
  selectedAnswers: string[];
  setSelectedAnswers: (selectedAnswers: string[]) => void;
  answers: AnswerRecord[];
  questionChecked: boolean;
  /**
   * How the shown answer was graded when it comes from the history, where
   * a flashcard graded by the learner has no response to grade again.
   */
  wasCorrect?: boolean | null;
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
  wasCorrect = null,
  nextAction,
  isQuizFinished,
  restartQuiz,
  togglePreviousQuestion,
  canGoBack,
  isHistoryQuestion,
  answerHints = [],
}: QuestionCardProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleAnswer = (answerId: string) => {
    if (questionChecked || question === null || question.type === "open") {
      return;
    }
    const selected = selectedAnswers.includes(answerId);
    if (question.type === "multiple_choice") {
      setSelectedAnswers(
        selected
          ? selectedAnswers.filter((id) => id !== answerId)
          : [...selectedAnswers, answerId],
      );
    } else {
      setSelectedAnswers(selected ? [] : [answerId]);
    }
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
        if (
          question !== null &&
          question.type !== "open" &&
          answerIndex < question.answers.length
        ) {
          toggleAnswer(question.answers[answerIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [question, selectedAnswers, toggleAnswer]);

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
            <CardDescription className="text-sm leading-relaxed">
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
                  Wbij nam gwiazdkę
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

  const open = question.type === "open";
  const noResponse = selectedAnswers.length === 0;
  const correct =
    questionChecked && (wasCorrect ?? gradeResponse(question, selectedAnswers));
  // A record without a response is a skipped question, or a flashcard the
  // learner graded themselves.
  const status = questionChecked
    ? correct
      ? noResponse
        ? "Fiszka oceniona jako znana"
        : "Poprawna odpowiedź!"
      : noResponse
        ? isHistoryQuestion
          ? "Pominięto lub oceniono jako nieznane"
          : open
            ? "Nie podano odpowiedzi"
            : "Nie wybrano odpowiedzi"
        : "Niepoprawna odpowiedź."
    : null;

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
            <div className="flex flex-col items-start gap-2">
              <span className="inline-flex w-full items-center gap-2">
                Pytanie {question.order}.
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
                {question.is_ai_generated === true ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge
                          variant="outline"
                          className="border-primary/20 text-primary/70 my-px ml-auto shrink-0 gap-1 px-1.5 select-none"
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
              </span>
              <span className="inline-block leading-tight">
                <MarkdownRenderer
                  className="inline-block"
                  enabled={question.is_markdown_enabled !== false}
                >
                  {String.raw`${question.text}`}
                </MarkdownRenderer>
              </span>
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
        {open ? (
          <OpenAnswer
            question={question}
            response={selectedAnswers[0] ?? ""}
            checked={questionChecked}
            graded={wasCorrect}
            onChange={(response) => {
              setSelectedAnswers(response === "" ? [] : [response]);
            }}
            onSubmit={nextAction}
          />
        ) : (
          <ChoiceAnswers
            question={question}
            selectedAnswers={selectedAnswers}
            checked={questionChecked}
            onToggle={toggleAnswer}
            answerHints={answerHints}
          />
        )}
        <div className="mt-4 min-h-5 text-sm">
          {status === null ? null : (
            <p
              className={
                correct
                  ? "font-medium text-green-600 dark:text-green-400"
                  : "text-destructive font-medium"
              }
            >
              {status}
            </p>
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
            <MarkdownRenderer enabled={question.is_markdown_enabled !== false}>
              {question.explanation}
            </MarkdownRenderer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
