"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { QuizEditor } from "@/components/quiz/quiz-editor";
import { QuizPreviewDialog } from "@/components/quiz/quiz-preview-dialog";
import type { QuizFormData } from "@/lib/schemas/quiz.schema";
import { prepareQuizForSubmission } from "@/lib/schemas/quiz.schema";
import { getQuizService } from "@/services";
import type { Quiz } from "@/types/quiz";

export function CreateQuizPageClient() {
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);

  async function handleSave(data: QuizFormData): Promise<boolean> {
    try {
      const payload = prepareQuizForSubmission(data);
      const result = await getQuizService().createQuiz(payload);
      setQuiz(result);
      toast.success("Quiz został utworzony.");
      return true;
    } catch {
      toast.error("Wystąpił błąd podczas importowania quizu.");
      return false;
    }
  }

  return (
    <>
      <QuizEditor mode="create" onSave={handleSave} />
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
