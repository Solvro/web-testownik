"use client";
/* eslint-disable react-refresh/only-export-components */
import { makeAssistantToolUI, useToolArgsStatus } from "@assistant-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
import type { Question, QuizWithUserProgress } from "@/types/quiz";

const questionPayloadSchema = z.object({
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

interface GeneratedQuestionsArguments {
  questions?: GeneratedQuestion[];
}

function AnswerSkeleton() {
  return (
    <div className="border-border flex w-full items-center gap-2 rounded-md border px-3 py-2.5">
      <div className="bg-muted h-3.5 w-2/3 animate-pulse rounded" />
    </div>
  );
}

function isQuestionComplete(question: GeneratedQuestion | undefined): boolean {
  if (question === undefined) {
    return false;
  }
  return (
    question.text !== undefined &&
    question.text !== "" &&
    question.answers !== undefined &&
    question.answers.length >= 2 &&
    question.answers.every(
      (a) =>
        a.text !== undefined && a.text !== "" && a.is_correct !== undefined,
    )
  );
}

function QuestionCard({
  question,
  isComplete,
  isBulkSaved,
}: {
  question: GeneratedQuestion;
  isComplete: boolean;
  isBulkSaved: boolean;
}) {
  const { quizId, canEdit } = useAiChatContext();
  const queryClient = useQueryClient();
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(isBulkSaved);

  const answers = question.answers ?? [];
  const isMultiple =
    isComplete && answers.filter((a) => a.is_correct === true).length > 1;

  if (isBulkSaved && !saved) {
    setSaved(true);
  }

  const { isPending: isSaving, mutateAsync: saveToQuiz } = useMutation({
    mutationFn: async () => {
      const payload = questionPayloadSchema.parse({
        text: question.text,
        explanation: question.explanation,
        multiple: isMultiple,
        answers: answers.map((a) => ({
          text: a.text,
          is_correct: a.is_correct,
        })),
      });
      return await getQuizService().createQuestion(quizId, {
        ...payload,
        is_ai_generated: true,
      });
    },
    onSuccess: (newQuestion: Question) => {
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
    if (checked || !isComplete) {
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
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex size-5 items-center justify-center rounded-full">
            <SparklesIcon className="text-primary size-3" />
          </div>
          <CardTitle className="text-xs font-medium">
            Wygenerowane pytanie
          </CardTitle>
          {isComplete ? (
            <Badge
              variant="outline"
              className="text-primary/70 border-primary/20 ml-auto gap-1 px-1.5 py-0 text-[10px]"
            >
              <SparklesIcon className="size-2.5" />
              AI
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="ml-auto gap-1 px-1.5 py-0 text-[10px]"
            >
              <LoaderCircleIcon className="size-2.5 animate-spin" />
              Generowanie...
            </Badge>
          )}
        </div>
        {question.text !== undefined && question.text !== "" ? (
          <CardDescription className="text-foreground mt-1.5 overflow-y-auto text-sm leading-snug font-medium">
            <MarkdownRenderer>{question.text}</MarkdownRenderer>
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
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
                  disabled={checked || !isComplete}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 w-full justify-start rounded-md border px-3 py-2.5 text-left font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
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

        {isComplete ? null : <AnswerSkeleton />}

        {checked ? (
          <div className="pt-1 text-sm">
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

        {isComplete && !checked && hasAnswers ? (
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={handleCheck}
            disabled={selectedAnswers.length === 0}
          >
            Sprawdź odpowiedź
          </Button>
        ) : null}

        {checked && isComplete && question.explanation !== undefined ? (
          <div className="pt-1">
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

        {isComplete && hasAnswers && canEdit ? (
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

function LoadingCard() {
  return (
    <Card className="border-primary/20 from-primary/5 bg-linear-to-br to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex size-5 items-center justify-center rounded-full">
            <SparklesIcon className="text-primary size-3" />
          </div>
          <CardTitle className="text-xs font-medium">
            Wygenerowane pytanie
          </CardTitle>
          <Badge
            variant="secondary"
            className="ml-auto gap-1 px-1.5 py-0 text-[10px]"
          >
            <LoaderCircleIcon className="size-2.5 animate-spin" />
            Generowanie...
          </Badge>
        </div>
        <div className="bg-muted mt-1.5 h-4 w-4/5 animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        <AnswerSkeleton />
        <AnswerSkeleton />
      </CardContent>
    </Card>
  );
}

function QuestionsCarousel({ questions }: { questions: GeneratedQuestion[] }) {
  const { quizId, canEdit } = useAiChatContext();
  const { status } = useToolArgsStatus();
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isBulkSaved, setIsBulkSaved] = useState(false);

  const isToolComplete = status === "complete";
  const visibleQuestions = questions.filter(
    (q) => q.text !== undefined && q.text !== "",
  );
  const count = visibleQuestions.length;
  const showNav = count > 1;

  const savablePayloads = (() => {
    if (!isToolComplete || isBulkSaved) {
      return [];
    }
    return visibleQuestions.flatMap((q) => {
      const result = questionPayloadSchema.safeParse({
        text: q.text,
        explanation: q.explanation,
        multiple:
          (q.answers ?? []).filter((a) => a.is_correct === true).length > 1,
        answers: (q.answers ?? []).map((a) => ({
          text: a.text,
          is_correct: a.is_correct,
        })),
      });
      return result.success ? [result.data] : [];
    });
  })();

  const handleSaveAll = async () => {
    if (savablePayloads.length === 0) {
      return;
    }
    setIsSavingAll(true);
    try {
      const newQuestions = await getQuizService().bulkCreateQuestions(
        quizId,
        savablePayloads.map((p) => ({ ...p, is_ai_generated: true })),
      );
      setIsBulkSaved(true);
      toast.success(`Dodano ${newQuestions.length.toString()} pytań do quizu`);
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (old) => {
          if (old === undefined) {
            void queryClient.refetchQueries({ queryKey: ["quiz", quizId] });
            return old;
          }
          return {
            ...old,
            questions: [...old.questions, ...newQuestions],
          };
        },
      );
    } catch {
      toast.error("Nie udało się dodać pytań");
    } finally {
      setIsSavingAll(false);
    }
  };

  if (status === "running" && visibleQuestions.length === 0) {
    return <LoadingCard />;
  }

  return (
    <div className="flex flex-col gap-2">
      {visibleQuestions.map((question, index) => (
        <div
          key={`question-${index.toString()}`}
          className={showNav && index !== activeIndex ? "hidden" : undefined}
        >
          <QuestionCard
            question={question}
            isComplete={isQuestionComplete(question)}
            isBulkSaved={isBulkSaved}
          />
        </div>
      ))}

      {showNav ? (
        <div className="mb-2 space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setActiveIndex((current) => Math.max(0, current - 1));
              }}
              disabled={activeIndex === 0}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-muted-foreground text-xs font-medium tabular-nums">
              {(activeIndex + 1).toString()} / {count.toString()}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setActiveIndex((current) => Math.min(count - 1, current + 1));
              }}
              disabled={activeIndex >= count - 1}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          {canEdit && savablePayloads.length > 1 ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                void handleSaveAll();
              }}
              disabled={isSavingAll}
            >
              {isSavingAll ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  Dodawanie...
                </>
              ) : (
                <>
                  <PlusIcon className="size-3.5" />
                  Dodaj wszystkie do quizu ({savablePayloads.length.toString()})
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const GeneratedQuestionsToolUI = makeAssistantToolUI<
  GeneratedQuestionsArguments,
  string
>({
  toolName: "generate_practice_questions",
  render: ({ args, status }) => {
    if (status.type === "incomplete") {
      return (
        <Card className="border-destructive/20 from-destructive/5 bg-linear-to-br to-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-destructive/10 flex size-5 items-center justify-center rounded-full">
                <AlertTriangleIcon className="text-destructive size-3" />
              </div>
              <CardTitle className="text-xs font-medium">
                Błąd generowania pytań
              </CardTitle>
            </div>
            <CardDescription className="text-destructive/70 mt-1 text-sm">
              Generowanie nie powiodło się. Spróbuj ponownie.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
    const questions = args.questions ?? [];
    if (questions.length === 0 && status.type !== "running") {
      return null;
    }
    return <QuestionsCarousel questions={questions} />;
  },
});
