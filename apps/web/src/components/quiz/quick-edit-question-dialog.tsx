"use client";

import { useSelector } from "@tanstack/react-form";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QuizFormData } from "@testownik/core/quiz/schema";
import {
  prepareQuestionForSubmission,
  validateQuizForm,
} from "@testownik/core/quiz/schema";
import type {
  Question,
  Quiz,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import { ExternalLinkIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { focusField } from "@/components/quiz/editor/focus-field";
import { QuestionEditor } from "@/components/quiz/editor/question-editor";
import {
  setUploading,
  useQuizEditorForm,
} from "@/components/quiz/editor/quiz-editor-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { getQuizService } from "@/services";

import {
  quizDetailQueryKey,
  quizQueryKey,
  removeQuestionFromQuiz,
  removeQuestionFromQuizCache,
  replaceQuestionInQuiz,
} from "./helpers/utils";

interface QuickEditQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question;
  quizId: string;
  /** Takes the edited question instead of saving it to the API. */
  onSaveDraft?: (question: Question) => void;
  onQuestionDeleted?: (
    deletedQuestionId: string,
    newCurrentQuestionId: string | null,
  ) => void;
  hideDelete?: boolean;
  hideFullEditor?: boolean;
  minAnswers?: number;
}

function updateCachedQuiz<TQuiz extends Quiz>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (quiz: TQuiz) => TQuiz,
) {
  queryClient.setQueryData<TQuiz>(queryKey, (oldData) => {
    if (oldData == null) {
      void queryClient.refetchQueries({ queryKey, exact: true });
      return oldData;
    }

    return updater(oldData);
  });
}

/**
 * Edits one question with the quiz editor's question card, in a dialog. The
 * form is created when the dialog opens, so a cancelled edit is forgotten.
 */
export function QuickEditQuestionDialog({
  open,
  onOpenChange,
  ...props
}: QuickEditQuestionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        aria-describedby={undefined}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Edycja pytania {String(props.question.order)}
        </DialogTitle>
        <QuickEditQuestionForm
          {...props}
          onClose={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function QuickEditQuestionForm({
  question,
  quizId,
  onSaveDraft,
  onQuestionDeleted,
  hideDelete = false,
  hideFullEditor = false,
  minAnswers = 1,
  onClose,
}: Omit<QuickEditQuestionDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState(0);
  const uploadsRef = useRef(0);
  // The editor's quiz has one question; the title only satisfies the schema.
  const defaultValues: QuizFormData = {
    title: "Pytanie",
    description: "",
    questions: [
      {
        ...question,
        answers: question.answers.toSorted((a, b) => a.order - b.order),
      },
    ],
  };

  const { mutateAsync: saveQuestion } = useMutation({
    mutationFn: async (value: QuizFormData) => {
      const payload = prepareQuestionForSubmission(value.questions[0]);
      return await getQuizService().updateQuestion(question.id, payload);
    },
    onSuccess: (updatedQuestion) => {
      updateCachedQuiz<Quiz>(queryClient, quizQueryKey(quizId), (quiz) =>
        replaceQuestionInQuiz(quiz, updatedQuestion),
      );
      updateCachedQuiz<QuizWithUserProgress>(
        queryClient,
        quizDetailQueryKey(quizId),
        (quiz) => replaceQuestionInQuiz(quiz, updatedQuestion),
      );
    },
  });

  const { isPending: isDeleting, mutateAsync: deleteQuestion } = useMutation({
    mutationFn: async () => {
      return await getQuizService().deleteQuestion(question.id);
    },
    onSuccess: (newCurrentQuestionId) => {
      toast.success("Pytanie usunięte");
      updateCachedQuiz<Quiz>(queryClient, quizQueryKey(quizId), (quiz) =>
        removeQuestionFromQuiz(quiz, question.id),
      );
      updateCachedQuiz<QuizWithUserProgress>(
        queryClient,
        quizDetailQueryKey(quizId),
        (quiz) =>
          removeQuestionFromQuizCache({
            quiz,
            deletedQuestionId: question.id,
            newCurrentQuestionId,
          }),
      );
      onQuestionDeleted?.(question.id, newCurrentQuestionId);
      onClose();
    },
    onError: () => {
      toast.error("Nie udało się usunąć pytania");
    },
  });

  const form = useQuizEditorForm({
    defaultValues,
    onInvalid: (value) => {
      const validation = validateQuizForm(value);
      if (validation.success) {
        return;
      }
      const answerIndex =
        validation.path?.[2] === "answers" ? validation.path[3] : undefined;
      const answer =
        typeof answerIndex === "number"
          ? value.questions[0].answers.at(answerIndex)
          : undefined;
      focusField(
        answer === undefined
          ? `question-text-${question.id}`
          : `answer-text-${answer.id}`,
      );
      toast.error(validation.error);
    },
    onSave: async (value) => {
      if (onSaveDraft !== undefined) {
        onSaveDraft(value.questions[0]);
        onClose();
        return value;
      }
      try {
        const saved = await saveQuestion(value);
        toast.success("Pytanie zaktualizowane");
        onClose();
        return { ...value, questions: [saved] };
      } catch {
        toast.error("Nie udało się zaktualizować pytania");
        return null;
      }
    },
  });
  const isSaving = useSelector(form.atom, (state) => state.isSubmitting);

  function trackUpload(change: number) {
    uploadsRef.current = Math.max(0, uploadsRef.current + change);
    setUploads(uploadsRef.current);
    setUploading(form, uploadsRef.current);
  }

  async function save() {
    if (isSaving || uploads > 0) {
      return;
    }
    if (form.state.values.questions[0].answers.length < minAnswers) {
      toast.error(
        `Pytanie musi mieć przynajmniej ${String(minAnswers)} odpowiedzi`,
      );
      return;
    }
    await form.handleSubmit();
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuestionEditor
          embedded
          form={form}
          index={0}
          questionId={question.id}
          count={1}
          number={String(question.order)}
          onNext={() => {
            void save();
          }}
          onAdd={() => {
            void save();
          }}
          onUploadStart={() => {
            trackUpload(1);
          }}
          onUploadEnd={() => {
            trackUpload(-1);
          }}
        />
      </div>
      <DialogFooter className="border-border mx-0 mb-0 flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
        <div className="flex items-center gap-1">
          {hideDelete ? null : (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={isSaving || isDeleting}
                  >
                    <Trash2Icon />
                    Usuń pytanie
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Czy na pewno chcesz usunąć to pytanie?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tej operacji nie można cofnąć.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await deleteQuestion();
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Usuwanie..." : "Usuń"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {hideFullEditor ? null : (
            <Button
              variant="ghost"
              nativeButton={false}
              render={
                <Link href={`/edit-quiz/${quizId}#question-${question.id}`}>
                  Pełny edytor
                  <ExternalLinkIcon />
                </Link>
              }
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={() => {
              void save();
            }}
            disabled={isSaving || uploads > 0}
          >
            {isSaving ? (
              <>
                <Loader2Icon className="animate-spin" />
                Zapisywanie...
              </>
            ) : (
              "Zapisz zmiany"
            )}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
