"use client";

import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { QuizPreviewDialog } from "@/components/quiz/quiz-preview-dialog";
import type { QuizFormData } from "@/lib/schemas/quiz.schema";
import type { Quiz } from "@/types/quiz";

export function CreateQuizPageClient() {
  const appContext = useContext(AppContext);
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);

  async function handleSave(data: QuizFormData): Promise<boolean> {
    try {
      const result = await appContext.services.quiz.createQuiz({
        title: data.title,
        description: data.description,
        questions: data.questions,
      });
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
