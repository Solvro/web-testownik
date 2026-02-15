import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { RotateCcwIcon, Undo2 } from "lucide-react";
import { ViewTransition, useEffect } from "react";

import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { computeAnswerVariant } from "@/components/quiz/helpers/question-card";
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
import { cn } from "@/lib/utils";
import type { Question } from "@/types/quiz";

interface QuestionCardProps {
  quizId: string;
  question: Question | null;
  selectedAnswers: string[];
  setSelectedAnswers: (selectedAnswers: string[]) => void;
  questionChecked: boolean;
  nextAction: () => void;
  isQuizFinished: boolean;
  restartQuiz?: () => void;
  goToPreviousQuestion: () => void;
  canGoBack: boolean;
  isHistoryQuestion: boolean;
}

export function QuestionCard({
  quizId,
  question,
  selectedAnswers,
  setSelectedAnswers,
  questionChecked,
  nextAction,
  isQuizFinished,
  restartQuiz,
  goToPreviousQuestion,
  canGoBack,
  isHistoryQuestion,
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
        newSelectedAnswers.push(answerId); // Add answer if not already selected
      } else {
        newSelectedAnswers.splice(answerIndex, 1); // Remove answer if already selected
      }
    } else {
      // If the answer is already selected, remove it
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
      // Only process number keys 1-9
      if (event.key >= "1" && event.key <= "9") {
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
    );
  }

  if (question == null) {
    return null;
  }

  // Check if the question was answered correctly with all required answers
  const isQuestionAnsweredCorrectly = () => {
    return (
      questionChecked &&
      question.answers.filter((answer) => {
        return answer.is_correct !== selectedAnswers.includes(answer.id);
      }).length === 0
    );
  };

  return (
    <Card>
      <CardHeader>
        <ScrollArea className="w-full min-w-0">
          <CardTitle className="mb-1 font-medium">
            <MarkdownRenderer>
              {`${String(question.order)}\\. ${question.text}`}
            </MarkdownRenderer>
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
          {question.answers.map((answer) => {
            return (
              <button
                key={`answer-${answer.id}`}
                id={`answer-${answer.id}`}
                onClick={() => {
                  handleAnswerClick(answer.id);
                }}
                disabled={questionChecked}
                className={cn(
                  "bg-input dark:bg-background w-full justify-start rounded-md border px-4 py-3 text-left font-medium transition-colors focus:outline-none disabled:cursor-not-allowed",
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
            );
          })}
        </div>
        <div className="mt-4 min-h-5 text-sm">
          {questionChecked && isQuestionAnsweredCorrectly() ? (
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
            <Button variant="outline" onClick={goToPreviousQuestion}>
              Powrót do pytań
            </Button>
          ) : (
            <>
              {canGoBack && !questionChecked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToPreviousQuestion}
                    >
                      <Undo2 />
                    </Button>
                  </TooltipTrigger>
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
