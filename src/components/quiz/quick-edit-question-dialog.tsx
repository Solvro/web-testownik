"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, LoaderCircleIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import {
  QuestionFormContent,
  QuestionFormHeader,
} from "@/components/quiz/editor";
import type { ImageState } from "@/components/quiz/editor/image";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
  prepareQuestionForSubmission,
  validateQuestionForm,
} from "@/lib/schemas/quiz.schema";
import { getQuizService } from "@/services";
import type { Question, Quiz, QuizWithUserProgress } from "@/types/quiz";

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

export function QuickEditQuestionDialog({
  open,
  onOpenChange,
  question,
  quizId,
  onSaveDraft,
  onQuestionDeleted,
  hideDelete = false,
  hideFullEditor = false,
  minAnswers = 1,
}: QuickEditQuestionDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(question);

  const [isImageUploading, setIsImageUploading] = useState(false);
  const { upload } = useImageUpload();

  function handleImageChange(state: ImageState) {
    setFormData((previous) => ({
      ...previous,
      image: state.image,
      image_url: state.imageUrl,
      image_upload: state.uploadId,
      image_width: state.width ?? null,
      image_height: state.height ?? null,
    }));
  }

  async function handleUpload(file: File) {
    setIsImageUploading(true);
    await upload(
      file,
      (url, id, width, height) => {
        handleImageChange({
          image: url,
          uploadId: id,
          imageUrl: null,
          width: width ?? null,
          height: height ?? null,
        });
        setIsImageUploading(false);
      },
      () => {
        handleImageChange({
          image: null,
          uploadId: null,
          imageUrl: null,
        });
        setIsImageUploading(false);
      },
    );
  }

  const { isPending: isSaving, mutateAsync: saveQuestion } = useMutation({
    mutationFn: async () => {
      const payload = prepareQuestionForSubmission(formData);
      return await getQuizService().updateQuestion(question.id, payload);
    },
    onSuccess: (updatedQuestion) => {
      toast.success("Pytanie zaktualizowane");
      updateCachedQuiz<Quiz>(queryClient, quizQueryKey(quizId), (quiz) =>
        replaceQuestionInQuiz(quiz, updatedQuestion),
      );
      updateCachedQuiz<QuizWithUserProgress>(
        queryClient,
        quizDetailQueryKey(quizId),
        (quiz) => replaceQuestionInQuiz(quiz, updatedQuestion),
      );
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować pytania");
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
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Nie udało się usunąć pytania");
    },
  });

  const handleSave = async () => {
    const validation = validateQuestionForm(formData);

    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    if (validation.data.answers.length < minAnswers) {
      toast.error(
        `Pytanie musi mieć przynajmniej ${minAnswers.toString()} odpowiedzi`,
      );
      return;
    }

    if (onSaveDraft !== undefined) {
      onSaveDraft(validation.data);
      onOpenChange(false);
      return;
    }

    await saveQuestion();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col gap-0 sm:max-w-4xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="pr-6">
          <DialogTitle className="sr-only">Edycja pytania</DialogTitle>
          <QuestionFormHeader
            question={formData}
            onUpdate={(updates) => {
              setFormData((previous) => ({ ...previous, ...updates }));
            }}
            isImageUploading={isImageUploading}
            onImageChange={handleImageChange}
            onUpload={handleUpload}
            hideDelete
          />
        </DialogHeader>

        <div className="-mx-6 -my-1 flex-1 overflow-y-auto px-6 py-1">
          <QuestionFormContent
            question={formData}
            onUpdate={(updates) => {
              setFormData((previous) => ({ ...previous, ...updates }));
            }}
            isImageUploading={isImageUploading}
            onImageChange={handleImageChange}
            onUpload={handleUpload}
            minAnswers={minAnswers}
          />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            {hideDelete ? null : (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                      Usuń pytanie
                    </Button>
                  }
                ></AlertDialogTrigger>

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
                    Pełny edytor <ExternalLinkIcon className="ml-2 size-4" />
                  </Link>
                }
              ></Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                "Zapisz zmiany"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
