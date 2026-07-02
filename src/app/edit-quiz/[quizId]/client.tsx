"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { Loader } from "@/components/loader";
import {
  quizDetailQueryKey,
  quizQueryKey,
} from "@/components/quiz/helpers/utils";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useQuiz } from "@/hooks/use-quiz";
import type { QuizFormData } from "@/lib/schemas/quiz.schema";
import { prepareQuizForSubmission } from "@/lib/schemas/quiz.schema";
import { getQuizService } from "@/services";

interface EditQuizPageClientProps {
  quizId: string;
}

function EditQuizPageContent({
  quizId,
}: {
  quizId: string;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParameters = useSearchParams();

  const {
    data: initialQuiz,
    isLoading,
    isError,
  } = useQuiz(quizId, {
    enabled: quizId.trim() !== "",
    staleTime: 0,
    refetchOnMount: "always",
  });
  const isInvalidQuizId = quizId.trim() === "";

  if (typeof document !== "undefined") {
    document.title = "Edytuj quiz - Testownik Solvro";
  }

  useEffect(() => {
    if (initialQuiz == null) {
      return;
    }

    const timeout = setTimeout(() => {
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

    return () => {
      clearTimeout(timeout);
    };
  }, [initialQuiz, searchParameters]);

  async function handleSave(data: QuizFormData): Promise<boolean> {
    if (quizId.trim() === "") {
      toast.error("Nieprawidłowy identyfikator quizu.");
      return false;
    }
    const payload = prepareQuizForSubmission(data);
    try {
      const updatedQuiz = await getQuizService().updateQuiz(quizId, payload);
      queryClient.setQueryData(quizQueryKey(quizId), updatedQuiz);
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
      await queryClient.refetchQueries({
        queryKey: quizDetailQueryKey(quizId),
      });
      const navigation = window.navigation as Navigation | null;

      if (navigation?.canGoBack === true) {
        router.back();
      } else {
        router.push("/quizzes");
      }
    }
    return ok;
  }

  if (isLoading) {
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
      {isInvalidQuizId || isError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {isInvalidQuizId
              ? "Nieprawidłowy identyfikator quizu."
              : "Wystąpił błąd podczas ładowania quizu."}
          </AlertDescription>
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
