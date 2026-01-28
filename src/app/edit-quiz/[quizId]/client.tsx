"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Loader } from "@/components/loader";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import type { QuizFormData } from "@/lib/schemas/quiz.schema";
import { prepareQuizForSubmission } from "@/lib/schemas/quiz.schema";
import type { Quiz } from "@/types/quiz";

interface EditQuizPageClientProps {
  quizId: string;
}

function EditQuizPageContent({
  quizId,
}: {
  quizId: string;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const appContext = useContext(AppContext);
  const router = useRouter();
  const searchParameters = useSearchParams();

  const [initialQuiz, setInitialQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  if (typeof document !== "undefined") {
    document.title = "Edytuj quiz - Testownik Solvro";
  }

  useEffect(() => {
    async function fetchQuiz() {
      if (quizId.trim() === "") {
        setError("Nieprawidłowy identyfikator quizu.");
        setLoading(false);
        return;
      }
      try {
        const data: Quiz = await appContext.services.quiz.getQuiz(quizId);
        setInitialQuiz(data);
        setTimeout(() => {
          const scrollTo = searchParameters.get("scroll_to");
          const hashId = window.location.hash.slice(1);
          const id = scrollTo ?? hashId;
          if (id !== "") {
            const element = document.querySelector(`#${id}`);
            if (element !== null) {
              element.scrollIntoView({ behavior: "smooth" });
              if (window.location.hash) {
                window.history.replaceState(
                  null,
                  "",
                  window.location.pathname + window.location.search,
                );
              }
            }
          }
        }, 100);
      } catch {
        setError("Wystąpił błąd podczas ładowania quizu.");
      } finally {
        setLoading(false);
      }
    }

    void fetchQuiz();
  }, [quizId, appContext.services.quiz, appContext.isGuest, searchParameters]);

  async function handleSave(data: QuizFormData): Promise<boolean> {
    if (quizId.trim() === "") {
      toast.error("Nieprawidłowy identyfikator quizu.");
      return false;
    }
    const payload = prepareQuizForSubmission(data);
    try {
      await appContext.services.quiz.updateQuiz(quizId, payload);
      toast.success("Quiz został zaktualizowany.");
      return true;
    } catch {
      toast.error("Wystąpił błąd podczas aktualizacji quizu.");
      return false;
    }
  }

  async function handleSaveAndClose(data: QuizFormData): Promise<boolean> {
    const ok = await handleSave(data);
    if (ok) {
      await queryClient.refetchQueries({ queryKey: ["quiz", quizId] });
      const navigation = window.navigation as Navigation | null;

      if (navigation?.canGoBack === true) {
        router.back();
      } else {
        router.push("/quizzes");
      }
    }
    return ok;
  }

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

export function EditQuizPageClient({ quizId }: EditQuizPageClientProps) {
  return <EditQuizPageContent quizId={quizId} />;
}
