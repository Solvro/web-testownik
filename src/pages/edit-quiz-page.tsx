import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { Loader } from "@/components/loader.tsx";
import type { QuizEditorResult } from "@/components/quiz/quiz-editor";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import type { Quiz } from "@/types/quiz.ts";

export function EditQuizPage(): React.JSX.Element {
  const { quizId } = useParams<{ quizId: string }>();
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [initialQuiz, setInitialQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  document.title = "Edytuj quiz - Testownik Solvro";

  useEffect(() => {
    const fetchQuiz = async () => {
      if (quizId == null || quizId.trim() === "") {
        setError("Nieprawidłowy identyfikator quizu.");
        setLoading(false);
        return;
      }
      try {
        const data: Quiz = await appContext.services.quiz.getQuiz(quizId);
        setInitialQuiz(data);
        setTimeout(async () => {
          const queryParameters = new URLSearchParams(location.search);
          if (location.hash || queryParameters.has("scroll_to")) {
            const hashId = window.location.hash.slice(1);
            const scrollId = queryParameters.get("scroll_to");
            const id = scrollId ?? hashId;
            const element = document.querySelector(`#${id}`);
            if (element !== null) {
              element.scrollIntoView({ behavior: "smooth" });
              if (window.location.hash) {
                window.history.replaceState(
                  null,
                  "",
                  window.location.pathname + window.location.search,
                );
              } else {
                queryParameters.delete("scroll_to");
                await navigate({
                  search: queryParameters.toString(),
                });
              }
            }
          }
        }, 100);
      } catch {
        setError("Wystąpił błąd podczas ładowania quizu.");
      } finally {
        setLoading(false);
      }
    };

    void fetchQuiz();
  }, [
    quizId,
    appContext.services.quiz,
    appContext.isGuest,
    location.hash,
    location.search,
    navigate,
  ]);

  const handleSave = async (data: QuizEditorResult) => {
    if (quizId === undefined || quizId.trim() === "") {
      toast.error("Nieprawidłowy identyfikator quizu.");
      return false;
    }
    const payload = {
      title: data.title,
      description: data.description,
      questions: data.questions,
    };
    try {
      await appContext.services.quiz.updateQuiz(quizId, payload);
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
      if (window.navigation == null) {
        await navigate(-1);
      } else {
        await (window.navigation.canGoBack
          ? navigate(-1)
          : navigate("/quizzes"));
      }
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
      {error !== null && error !== "" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <QuizEditor
        mode="edit"
        initialQuiz={initialQuiz ?? undefined}
        onSave={handleSave}
        onSaveAndClose={handleSaveAndClose}
      />
    </>
  );
}
