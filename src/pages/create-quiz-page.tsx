import React, { useContext, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import type { QuizEditorResult } from "@/components/quiz/quiz-editor";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { QuizPreviewDialog } from "@/components/quiz/quiz-preview-dialog.tsx";
import type { Quiz } from "@/types/quiz.ts";

export function CreateQuizPage(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null); // Result of the quiz creation

  document.title = "Stwórz quiz - Testownik Solvro";

  const handleSave = async (data: QuizEditorResult) => {
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
  };

  return (
    <>
      <QuizEditor mode="create" onSave={handleSave} />
      <QuizPreviewDialog
        open={quiz !== null}
        onOpenChange={(open) => {
          if (!open) {
            void navigate("/");
          }
        }}
        quiz={quiz}
        type="created"
      />
    </>
  );
}
