"use client";

import type { QuizFormData } from "@testownik/core/quiz/schema";
import { prepareQuizForSubmission } from "@testownik/core/quiz/schema";
import type { Quiz } from "@testownik/core/quiz/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { quizToFormData } from "@/components/quiz/editor/quiz-editor-form";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { QuizPreviewDialog } from "@/components/quiz/quiz-preview-dialog";
import { getQuizService } from "@/services";

export function CreateQuizPageClient({
  initialValues,
}: {
  initialValues: QuizFormData;
}) {
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);

  async function handleSave(data: QuizFormData): Promise<QuizFormData | null> {
    try {
      const payload = prepareQuizForSubmission(data);
      const result = await getQuizService().createQuiz(payload);
      setQuiz(result);
      toast.success("Quiz został utworzony.");
      return quizToFormData(result);
    } catch {
      toast.error("Wystąpił błąd podczas tworzenia quizu.");
      return null;
    }
  }

  return (
    <>
      <QuizEditor
        mode="create"
        initialValues={initialValues}
        onSave={handleSave}
      />
      <QuizPreviewDialog
        open={quiz !== null}
        onOpenChange={(open) => {
          if (!open) {
            router.push("/");
          }
        }}
        quiz={quiz}
        type="created"
      />
    </>
  );
}
