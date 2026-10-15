"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { QuizFormData } from "@testownik/core/quiz/schema";
import { prepareQuizForSubmission } from "@testownik/core/quiz/schema";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Loader } from "@/components/loader";
import { quizToFormData } from "@/components/quiz/editor/quiz-editor-form";
import {
  quizDetailQueryKey,
  quizQueryKey,
} from "@/components/quiz/helpers/utils";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useQuiz } from "@/hooks/use-quiz";
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

  async function handleSave(data: QuizFormData): Promise<QuizFormData | null> {
    if (quizId.trim() === "") {
      toast.error("Nieprawidłowy identyfikator quizu.");
      return null;
    }
    const payload = prepareQuizForSubmission(data);
    try {
      const updatedQuiz = await getQuizService().updateQuiz(quizId, payload);
      queryClient.setQueryData(quizQueryKey(quizId), updatedQuiz);
      toast.success("Quiz został zaktualizowany.");
      return quizToFormData(updatedQuiz);
    } catch {
      toast.error("Wystąpił błąd podczas aktualizacji quizu.");
      return null;
    }
  }

  async function handleClose() {
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

  if (isInvalidQuizId || initialQuiz === undefined) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          {isInvalidQuizId
            ? "Nieprawidłowy identyfikator quizu."
            : "Wystąpił błąd podczas ładowania quizu."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {isError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Nie udało się odświeżyć quizu. Twoje zmiany są nadal w edytorze.
          </AlertDescription>
        </Alert>
      ) : null}
      <QuizEditor
        key={quizId}
        mode="edit"
        initialQuiz={initialQuiz}
        onSave={handleSave}
        onClose={handleClose}
      />
    </>
  );
}

export function EditQuizPageClient({ quizId }: EditQuizPageClientProps) {
  return <EditQuizPageContent quizId={quizId} />;
}
