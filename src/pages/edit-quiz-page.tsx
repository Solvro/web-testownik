import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";

import Loader from "@/components/loader.tsx";
import type { QuizEditorResult } from "@/components/quiz/quiz-editor";
import QuizEditor from "@/components/quiz/quiz-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

import AppContext from "../app-context.tsx";
import type { Quiz } from "../components/quiz/types.ts";

function EditQuizPage(): React.JSX.Element {
  const { quizId } = useParams<{ quizId: string }>();
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParameters = new URLSearchParams(location.search);

  const [initialQuiz, setInitialQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  document.title = "Edytuj quiz - Testownik Solvro";

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        if (appContext.isGuest) {
          const userQuizzes = localStorage.getItem("guest_quizzes")
            ? JSON.parse(localStorage.getItem("guest_quizzes")!)
            : [];
          const quiz = userQuizzes.find((q: Quiz) => q.id === quizId);
          if (!quiz) {
            setError("Nie znaleziono quizu.");
            setLoading(false);
            return;
          }
          setInitialQuiz(quiz);
          setLoading(false);
          return;
        }
        const response = await appContext.axiosInstance.get(
          `/quizzes/${String(quizId)}/`,
        );
        if (response.status === 200) {
          const data: Quiz = response.data;
          setInitialQuiz(data);
          setTimeout(() => {
            if (location.hash || queryParameters.has("scroll_to")) {
              const element = document.getElementById(
                window.location.hash.slice(1) ||
                  queryParameters.get("scroll_to") ||
                  "",
              );
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
                if (window.location.hash) {
                  window.history.replaceState(
                    null,
                    "",
                    window.location.pathname + window.location.search,
                  );
                } else {
                  queryParameters.delete("scroll_to");
                  navigate({
                    search: queryParameters.toString(),
                  });
                }
              }
            }
          }, 100);
        } else {
          setError("Nie udało się załadować quizu.");
        }
      } catch {
        setError("Wystąpił błąd podczas ładowania quizu.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, appContext.axiosInstance]);

  const handleSave = async (data: QuizEditorResult) => {
    const payload = {
      title: data.title,
      description: data.description,
      questions: data.questions,
    };
    try {
      if (appContext.isGuest) {
        const userQuizzes = localStorage.getItem("guest_quizzes")
          ? JSON.parse(localStorage.getItem("guest_quizzes")!)
          : [];
        const quizIndex = userQuizzes.findIndex((q: Quiz) => q.id === quizId);
        if (quizIndex === -1) {
          toast.error("Nie znaleziono quizu.");
          return false;
        }
        userQuizzes[quizIndex] = { ...userQuizzes[quizIndex], ...payload };
        localStorage.setItem("guest_quizzes", JSON.stringify(userQuizzes));
        toast.success("Quiz został zaktualizowany.");
        return true;
      }
      const response = await appContext.axiosInstance.put(
        `/quizzes/${String(quizId)}/`,
        payload,
      );
      if (response.status !== 200) {
        const errorData = await response.data;
        toast.error(
          errorData.error || "Wystąpił błąd podczas aktualizacji quizu.",
        );
        return false;
      }
      toast.success("Quiz został zaktualizowany.");
      return true;
    } catch {
      toast.error("Wystąpił błąd podczas aktualizacji quizu.");
      return false;
    }
  };

  const handleSaveAndClose = async (
    data: QuizEditorResult,
  ): Promise<boolean> => {
    const ok = await handleSave(data);
    if (ok) {
      navigate("/");
    }
    return ok;
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="space-y-2 pb-8 text-center">
            <p>Ładowanie quizu...</p>
            <Loader size={15} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <QuizEditor
        mode="edit"
        initialQuiz={initialQuiz || undefined}
        onSave={handleSave}
        onSaveAndClose={handleSaveAndClose}
      />
    </>
  );
}

export default EditQuizPage;
