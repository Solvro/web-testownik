"use client";
/* eslint-disable react-refresh/only-export-components */
import { makeAssistantToolUI, useToolArgsStatus } from "@assistant-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckIcon,
  LoaderCircleIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";

import { useAiChatContext } from "@/components/ai/ai-chat-context";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { computeAnswerVariant } from "@/components/quiz/helpers/question-card";
import { quizDetailQueryKey } from "@/components/quiz/helpers/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getQuizService } from "@/services";
import type { QuizWithUserProgress } from "@/types/quiz";

const createQuestionPayloadSchema = z.object({
  text: z.string().min(1),
  explanation: z.string().optional(),
  multiple: z.boolean(),
  answers: z
    .array(
      z.object({
        text: z.string().min(1),
        is_correct: z.boolean(),
      }),
    )
    .min(2),
});

interface GeneratedAnswer {
  text?: string;
  is_correct?: boolean;
}

interface GeneratedQuestion {
  text?: string;
  answers?: GeneratedAnswer[];
  explanation?: string;
}

function AnswerSkeleton() {
  return (
    <div className="border-border flex w-full items-center gap-2 rounded-md border px-4 py-3">
      <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
    </div>
  );
}

function QuestionPreviewCard({ question }: { question: GeneratedQuestion }) {
  const { quizId } = useAiChatContext();
  const queryClient = useQueryClient();
  const { status, propStatus } = useToolArgsStatus();
  const isRunning = status === "running";
  const answersComplete = propStatus.answers === "complete";
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);

  const answers = question.answers ?? [];
  const isMultiple =
    answersComplete && answers.filter((a) => a.is_correct === true).length > 1;

  const { isPending: isSaving, mutateAsync: saveToQuiz } = useMutation({
    mutationFn: async () => {
      const payload = createQuestionPayloadSchema.parse({
        text: question.text,
        explanation: question.explanation,
        multiple: isMultiple,
        answers: answers.map((a) => ({
          text: a.text,
          is_correct: a.is_correct,
        })),
      });
      return await getQuizService().createQuestion(quizId, payload);
    },
    onSuccess: (newQuestion) => {
      setSaved(true);
      toast.success("Pytanie dodane do quizu");
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (old) => {
          if (old === undefined) {
            void queryClient.refetchQueries({
              queryKey: ["quiz", quizId],
            });
            return old;
          }
          return {
            ...old,
            questions: [...old.questions, newQuestion],
          };
        },
      );
    },
    onError: () => {
      toast.error("Nie udało się dodać pytania");
    },
  });

  const handleAnswerClick = (index: number) => {
    if (checked || isRunning) {
      return;
    }
    if (isMultiple) {
      setSelectedAnswers((previous) =>
        previous.includes(index)
          ? previous.filter((index_) => index_ !== index)
          : [...previous, index],
      );
    } else {
      setSelectedAnswers((previous) =>
        previous.includes(index) ? [] : [index],
      );
    }
  };

  const handleCheck = () => {
    if (selectedAnswers.length === 0) {
      return;
    }
    setChecked(true);
  };

  const hasAnswers = answers.length > 0;

  return (
    <Card className="border-primary/20 from-primary/5 bg-linear-to-br to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex size-6 items-center justify-center rounded-full">
            <SparklesIcon className="text-primary size-3.5" />
          </div>
          <CardTitle className="text-sm">Wygenerowane pytanie</CardTitle>
          {isRunning ? (
            <Badge variant="secondary" className="ml-auto text-xs">
              <LoaderCircleIcon className="size-3 animate-spin" />
              Generowanie...
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-primary/70 border-primary/20 ml-auto text-xs"
            >
              <SparklesIcon className="size-3" />
              AI
            </Badge>
          )}
        </div>
        {question.text === "" ? null : (
          <CardDescription className="text-foreground mt-2 overflow-y-auto text-sm font-medium">
            <MarkdownRenderer>{question.text}</MarkdownRenderer>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {hasAnswers
          ? answers.map((answer, index) => {
              if (answer.text === undefined || answer.text === "") {
                return null;
              }
              const isSelected = selectedAnswers.includes(index);
              return (
                <button
                  key={`gen-answer-${index.toString()}`}
                  onClick={() => {
                    handleAnswerClick(index);
                  }}
                  disabled={checked || !answersComplete}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 w-full justify-start rounded-md border px-4 py-3 text-left font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
                    "bg-input dark:bg-background",
                    computeAnswerVariant(
                      isSelected,
                      checked,
                      answer.is_correct ?? false,
                    ),
                  )}
                >
                  <MarkdownRenderer className="pointer-events-none w-full text-sm">
                    {answer.text}
                  </MarkdownRenderer>
                </button>
              );
            })
          : null}

        {answersComplete ? null : <AnswerSkeleton />}

        {checked ? (
          <div className="mt-2 text-sm">
            {selectedAnswers.every(
              (index) => answers[index]?.is_correct === true,
            ) &&
            answers.every(
              (a, index) =>
                a.is_correct !== true || selectedAnswers.includes(index),
            ) ? (
              <p className="font-medium text-green-600 dark:text-green-400">
                Poprawna odpowiedź!
              </p>
            ) : (
              <p className="text-destructive font-medium">
                Niepoprawna odpowiedź.
              </p>
            )}
          </div>
        ) : null}

        {answersComplete && !checked && hasAnswers ? (
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={handleCheck}
            disabled={selectedAnswers.length === 0}
          >
            Sprawdź odpowiedź
          </Button>
        ) : null}

        {checked && !isRunning && question.explanation !== undefined ? (
          <div className="mt-2">
            {showExplanation ? (
              <div className="bg-muted/40 rounded-lg border p-3 text-xs">
                <MarkdownRenderer>{question.explanation}</MarkdownRenderer>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowExplanation(true);
                }}
                className="text-xs"
              >
                Pokaż wyjaśnienie
              </Button>
            )}
          </div>
        ) : null}

        {answersComplete && hasAnswers ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              void saveToQuiz();
            }}
            disabled={isSaving || saved}
          >
            {isSaving ? (
              <>
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Dodawanie...
              </>
            ) : saved ? (
              <>
                <CheckIcon className="size-3.5" />
                Dodano do quizu
              </>
            ) : (
              <>
                <PlusIcon className="size-3.5" />
                Dodaj do quizu
              </>
            )}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ToolErrorCard({ label }: { label: string }) {
  return (
    <Card className="border-destructive/20 from-destructive/5 bg-linear-to-br to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-destructive/10 flex size-6 items-center justify-center rounded-full">
            <AlertTriangleIcon className="text-destructive size-3.5" />
          </div>
          <CardTitle className="text-sm">{label}</CardTitle>
        </div>
        <CardDescription className="text-destructive/70 mt-1 text-sm">
          Generowanie nie powiodło się. Spróbuj ponownie.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export const GeneratedQuestionToolUI = makeAssistantToolUI<
  GeneratedQuestion,
  string
>({
  toolName: "generate_practice_question",
  render: ({ args, status }) => {
    if (status.type === "incomplete") {
      return <ToolErrorCard label="Błąd generowania pytania" />;
    }
    if (args.text === undefined || args.text === "") {
      return null;
    }
    return <QuestionPreviewCard question={args} />;
  },
});
