import React, { useContext, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { uuidv4 } from "@/components/quiz/helpers/uuid.ts";
import type { QuizEditorResult } from "@/components/quiz/quiz-editor";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { QuizPreviewModal } from "@/components/quiz/quiz-preview-modal.tsx";
import type { Quiz } from "@/components/quiz/types.ts";

export function CreateQuizPage(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null); // Result of the quiz creation

  document.title = "Stwórz quiz - Testownik Solvro";

  const handleSave = async (data: QuizEditorResult) => {
    try {
      if (appContext.isGuest) {
        const guestQuizzesData = localStorage.getItem("guest_quizzes");
        const userQuizzes: Quiz[] =
          guestQuizzesData === null
            ? []
            : (JSON.parse(guestQuizzesData) as Quiz[]);
        const temporaryQuiz = {
          ...data,
          questions: data.questions,
          id: uuidv4(),
          visibility: 0,
          version: 1,
          allow_anonymous: false,
          is_anonymous: true,
          can_edit: true,
        };
        userQuizzes.push(temporaryQuiz);
        localStorage.setItem("guest_quizzes", JSON.stringify(userQuizzes));
        setQuiz(temporaryQuiz as unknown as Quiz);
        toast.success("Quiz został utworzony.");
        return true;
      }
      const response = await appContext.axiosInstance.post("/quizzes/", {
        title: data.title,
        description: data.description,
        questions: data.questions,
      });
      if (response.status === 201) {
        const result = await response.data;
        setQuiz(result);
        toast.success("Quiz został utworzony.");
        return true;
      }
      const errorData = await response.data;
      toast.error(
        errorData.error || "Wystąpił błąd podczas importowania quizu.",
      );
      return false;
    } catch {
      toast.error("Wystąpił błąd podczas importowania quizu.");
      return false;
    }
  };

  return (
    <>
      <QuizEditor mode="create" onSave={handleSave} />
      <QuizPreviewModal
        show={quiz !== null}
        onHide={async () => navigate("/")}
        quiz={quiz}
        type="created"
      />
    </>
  );
}
