import React, { useEffect } from "react";
import { Answer, Question } from "./types.ts";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeAnswerVariant } from "@/components/quiz/helpers/questionCard.ts";
import { RotateCcwIcon } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

interface QuestionCardProps {
  question: Question | null;
  selectedAnswers: number[];
  setSelectedAnswers: (selectedAnswers: number[]) => void;
  questionChecked: boolean;
  nextAction: () => void;
  isQuizFinished: boolean;
  restartQuiz?: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedAnswers,
  setSelectedAnswers,
  questionChecked,
  nextAction,
  isQuizFinished,
  restartQuiz,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only process number keys 1-9
      if (event.key >= "1" && event.key <= "9") {
        const answerIndex = parseInt(event.key, 10) - 1;
        if (question && answerIndex < question.answers.length) {
          handleAnswerClick(answerIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [question, selectedAnswers]);

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
            <Button variant="outline" onClick={restartQuiz}>
              <RotateCcwIcon />
              Uruchom ponownie quiz
            </Button>
          </div>
          <p className="text-muted-foreground mt-3 text-center text-xs">
            Lub idź się napić piwka, no i odpocznij - zasłużyłeś!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!question) {
    return null;
  }

  // Check if the question was answered correctly with all required answers
  const isQuestionAnsweredCorrectly = () => {
    return (
      questionChecked &&
      question.answers.filter((answer, idx) => {
        return answer.correct !== selectedAnswers.includes(idx);
      }).length === 0
    );
  };

  const handleAnswerClick = (idx: number) => {
    if (questionChecked) {
      return;
    }
    const newSelectedAnswers = [...selectedAnswers];
    const answerIndex = newSelectedAnswers.indexOf(idx);

    if (question.multiple) {
      if (answerIndex === -1) {
        newSelectedAnswers.push(idx); // Add answer if not already selected
      } else {
        newSelectedAnswers.splice(answerIndex, 1); // Remove answer if already selected
      }
    } else {
      // If the answer is already selected, remove it
      if (answerIndex !== -1) {
        newSelectedAnswers.splice(answerIndex, 1);
      }
      if (answerIndex === -1) {
        newSelectedAnswers.splice(0, newSelectedAnswers.length, idx);
      }
    }

    setSelectedAnswers(newSelectedAnswers);
  };

  return (
    <Card>
      <CardHeader>
        <ScrollArea className="w-full min-w-0">
          <CardTitle className="mb-1 space-y-2 font-medium">
            <Markdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {question.id + "\\. " + question.question}
            </Markdown>
          </CardTitle>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {question.image && (
          <CardDescription>
            <img
              src={question.image}
              alt={question.question}
              className="mx-auto mt-4 max-h-80 rounded border object-contain"
            />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {question.answers.map((answer: Answer, idx: number) => {
            return (
              <button
                key={`answer-${idx}`}
                id={`answer-${idx}`}
                onClick={() => handleAnswerClick(idx)}
                disabled={questionChecked}
                className={cn(
                  "w-full justify-start rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed",
                  computeAnswerVariant(
                    selectedAnswers.includes(idx),
                    questionChecked,
                    answer.correct,
                  ),
                )}
              >
                <span className="w-full">{answer.answer}</span>
                {answer.image && (
                  <img
                    src={answer.image}
                    alt={answer.answer}
                    className="max-h-40 w-full rounded object-contain"
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 min-h-[1.25rem] text-sm">
          {questionChecked && isQuestionAnsweredCorrectly() ? (
            <p className="font-medium text-green-600 dark:text-green-400">
              Poprawna odpowiedź!
            </p>
          ) : questionChecked && !selectedAnswers.length ? (
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
        <div className="mt-2 flex justify-end">
          {questionChecked ? (
            <Button onClick={nextAction}>Następne pytanie</Button>
          ) : (
            <Button onClick={nextAction}>Sprawdź odpowiedź</Button>
          )}
        </div>
        {question.explanation && questionChecked && (
          <div
            id="explanation"
            className="bg-muted/40 mt-6 max-w-none space-y-2 rounded-md border p-4 text-sm"
          >
            <Markdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {question.explanation}
            </Markdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuestionCard;
