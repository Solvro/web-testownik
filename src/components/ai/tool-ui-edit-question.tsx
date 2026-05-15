"use client";
/* eslint-disable react-refresh/only-export-components */
import { makeAssistantToolUI, useToolArgsStatus } from "@assistant-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckIcon,
  LoaderCircleIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAiChatContext } from "@/components/ai/ai-chat-context";
import { MarkdownRenderer } from "@/components/markdown-renderer";
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

interface EditedAnswer {
  text?: string;
  is_correct?: boolean;
}

interface EditedQuestion {
  text?: string;
  answers?: EditedAnswer[];
  explanation?: string;
}

function EditQuestionCard({ edit }: { edit: EditedQuestion }) {
  const { quizId, questionId } = useAiChatContext();
  const queryClient = useQueryClient();
  const { status, propStatus } = useToolArgsStatus();
  const isRunning = status === "running";
  const answersComplete = propStatus.answers === "complete";
  const [applied, setApplied] = useState(false);

  const answers = edit.answers ?? [];

  const { isPending, mutateAsync: applyEdit } = useMutation({
    mutationFn: async () => {
      if (questionId === null) {
        throw new Error("No current question");
      }
      const multiple = answers.filter((a) => a.is_correct === true).length > 1;
      return await getQuizService().updateQuestion(questionId, {
        text: edit.text,
        explanation: edit.explanation,
        multiple,
        answers: answers.map((a, index) => ({
          order: index + 1,
          text: a.text,
          is_correct: a.is_correct,
        })) as Question["answers"],
      });
    },
    onSuccess: (updatedQuestion) => {
      setApplied(true);
      toast.success("Pytanie zaktualizowane");
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (old) => {
          if (old === undefined) {
            void queryClient.refetchQueries({ queryKey: ["quiz", quizId] });
            return old;
          }
          return {
            ...old,
            questions: old.questions.map((q) =>
              q.id === questionId ? updatedQuestion : q,
            ),
          };
        },
      );
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować pytania");
    },
  });

  const hasAnswers = answers.length > 0;

  return (
    <Card className="border-amber-500/20 bg-linear-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-amber-500/10">
            <PencilIcon className="size-3.5 text-amber-600" />
          </div>
          <CardTitle className="text-sm">Proponowana edycja</CardTitle>
          {isRunning ? (
            <Badge variant="secondary" className="ml-auto text-xs">
              <LoaderCircleIcon className="size-3 animate-spin" />
              Generowanie...
            </Badge>
          ) : null}
        </div>
        {edit.text != null && edit.text !== "" ? (
          <CardDescription className="text-foreground mt-2 overflow-y-hidden text-sm font-medium">
            <MarkdownRenderer>{edit.text}</MarkdownRenderer>
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {hasAnswers
          ? answers.map((answer, index) => {
              if (answer.text == null || answer.text === "") {
                return null;
              }
              const isCorrect = answer.is_correct ?? false;
              return (
                <div
                  key={`edit-answer-${index.toString()}`}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm duration-200",
                    isCorrect
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border",
                  )}
                >
                  {isCorrect ? (
                    <CheckIcon className="size-3.5 shrink-0 text-green-600" />
                  ) : (
                    <XIcon className="text-muted-foreground size-3.5 shrink-0" />
                  )}
                  <MarkdownRenderer className="pointer-events-none">
                    {answer.text}
                  </MarkdownRenderer>
                </div>
              );
            })
          : null}

        {answersComplete ? null : (
          <div className="border-border flex w-full items-center gap-2 rounded-lg border px-3 py-2">
            <div className="bg-muted size-3.5 shrink-0 animate-pulse rounded-full" />
            <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
          </div>
        )}

        {answersComplete && edit.explanation !== undefined ? (
          <div className="bg-muted/40 mt-2 rounded-lg border p-3 text-xs">
            <p className="text-muted-foreground mb-1 font-medium">
              Wyjaśnienie:
            </p>
            <MarkdownRenderer>{edit.explanation}</MarkdownRenderer>
          </div>
        ) : null}

        {answersComplete && questionId !== null ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full border-amber-500/30 hover:bg-amber-500/10"
            onClick={() => {
              void applyEdit();
            }}
            disabled={isPending || applied}
          >
            {isPending ? (
              <>
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Zapisywanie...
              </>
            ) : applied ? (
              <>
                <CheckIcon className="size-3.5" />
                Zastosowano zmiany
              </>
            ) : (
              <>
                <PencilIcon className="size-3.5" />
                Zastosuj zmiany
              </>
            )}
          </Button>
        ) : null}

        {answersComplete && questionId === null ? (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Brak aktualnego pytania do edycji
          </p>
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

export const EditQuestionToolUI = makeAssistantToolUI<EditedQuestion, string>({
  toolName: "edit_question",
  render: ({ args, status }) => {
    if (status.type === "incomplete") {
      return <ToolErrorCard label="Błąd edycji pytania" />;
    }
    if (args.text == null || args.text === "") {
      return null;
    }
    return <EditQuestionCard edit={args} />;
  },
});
