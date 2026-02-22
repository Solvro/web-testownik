"use client";

import { FocusScope } from "@radix-ui/react-focus-scope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, LoaderCircleIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
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
import type { Question, QuizWithUserProgress } from "@/types/quiz";

import { quizDetailQueryKey } from "./hooks/use-active-quiz";

interface QuickEditQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question;
  quizId: string;
}

export function QuickEditQuestionDialog({
  open,
  onOpenChange,
  question,
  quizId,
}: QuickEditQuestionDialogProps) {
  const appContext = useContext(AppContext);
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
      return await appContext.services.quiz.updateQuestion(
        question.id,
        payload,
      );
    },
    onSuccess: (updatedQuestion) => {
      toast.success("Pytanie zaktualizowane");
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (oldData) => {
          if (oldData == null) {
            void queryClient.refetchQueries({ queryKey: ["quiz", quizId] });
            return oldData;
          }
          return {
            ...oldData,
            questions: oldData.questions.map((q) =>
              q.id === question.id ? updatedQuestion : q,
            ),
          };
        },
      );
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować pytania");
    },
  });

  const { isPending: isDeleting, mutateAsync: deleteQuestion } = useMutation({
    mutationFn: async () => {
      return await appContext.services.quiz.deleteQuestion(question.id);
    },
    onSuccess: (newCurrentQuestionId) => {
      toast.success("Pytanie usunięte");
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (oldData) => {
          if (oldData == null) {
            void queryClient.refetchQueries({ queryKey: ["quiz", quizId] });
            return oldData;
          }

          return {
            ...oldData,
            questions: oldData.questions.filter((q) => q.id !== question.id),
            current_session:
              oldData.current_session == null
                ? null
                : {
                    ...oldData.current_session,
                    current_question: newCurrentQuestionId ?? null,
                  },
          };
        },
      );
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

    await saveQuestion();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden px-0 sm:max-w-4xl"
        onKeyDown={(event_) => {
          event_.stopPropagation();
        }}
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pr-10">
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

        <div className="flex-1 overflow-y-auto px-6 py-1">
          <FocusScope>
            <QuestionFormContent
              question={formData}
              onUpdate={(updates) => {
                setFormData((previous) => ({ ...previous, ...updates }));
              }}
              isImageUploading={isImageUploading}
              onImageChange={handleImageChange}
              onUpload={handleUpload}
            />
          </FocusScope>
        </div>

        <DialogFooter className="flex items-center justify-between px-6 pt-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                  Usuń pytanie
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Czy na pewno chcesz usunąć to pytanie?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tej operacji nie można cofnąć. Pytanie zostanie trwale
                    usunięte z quizu.
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
            <Button variant="ghost" asChild>
              <Link href={`/edit-quiz/${quizId}#question-${question.id}`}>
                Pełny edytor <ExternalLinkIcon className="ml-2 size-4" />
              </Link>
            </Button>
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
