import {
  AlertCircleIcon,
  FolderArchiveIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { Loader } from "@/components/loader.tsx";
import { QuizCard } from "@/components/quiz/quiz-card.tsx";
import { ShareQuizDialog } from "@/components/quiz/share-quiz-dialog/share-quiz-dialog.tsx";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import type { QuizMetadata, SharedQuiz } from "@/types/quiz.ts";

export function QuizzesPage() {
  const appContext = useContext(AppContext);

  const [userQuizzes, setUserQuizzes] = useState<QuizMetadata[]>([]);
  const [sharedQuizzes, setSharedQuizzes] = useState<SharedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDialog, setCurrentDialog] = useState<{
    type: "share" | "delete" | null;
    quiz: QuizMetadata | null;
  }>({ type: null, quiz: null });

  document.title = "Twoje quizy - Testownik Solvro";

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const [fetchedUserQuizzes, fetchedSharedQuizzes] = await Promise.all([
          appContext.services.quiz.getQuizzes(),
          appContext.services.quiz.getSharedQuizzes(),
        ]);

        setUserQuizzes(fetchedUserQuizzes);

        const uniqueSharedQuizzes = fetchedSharedQuizzes.filter(
          (sq: SharedQuiz, index: number, self: SharedQuiz[]) =>
            index === self.findIndex((q) => q.quiz.id === sq.quiz.id) &&
            sq.quiz.maintainer?.id !== localStorage.getItem("user_id"),
        );
        setSharedQuizzes(uniqueSharedQuizzes);
      } catch {
        setError("Nie udało się załadować quizów.");
      } finally {
        setLoading(false);
      }
    };

    void fetchQuizzes();
  }, [appContext.services.quiz, appContext.isGuest]);

  const handleShareQuiz = (quiz: QuizMetadata) => {
    setCurrentDialog({ type: "share", quiz });
  };

  const handleDeleteQuiz = (quiz: QuizMetadata) => {
    setCurrentDialog({ type: "delete", quiz });
  };

  const confirmDeleteQuiz = async () => {
    if (currentDialog.quiz === null) {
      return;
    }

    const quiz = currentDialog.quiz;

    try {
      await appContext.services.quiz.deleteQuiz(quiz.id);
      setUserQuizzes((previous) => previous.filter((q) => q.id !== quiz.id));
      toast.success(`Quiz "${quiz.title}" został usunięty.`);
    } catch {
      toast.error("Nie udało się usunąć quizu.");
    }

    setCurrentDialog({ type: null, quiz: null });
  };

  const handleDownloadQuiz = async (quiz: QuizMetadata) => {
    try {
      const fullQuiz = await appContext.services.quiz.getQuiz(quiz.id);
      // Create a downloadable version
      const downloadableQuiz = {
        title: fullQuiz.title,
        description: fullQuiz.description,
        maintainer: fullQuiz.maintainer?.full_name ?? null,
        version: fullQuiz.version,
        questions: fullQuiz.questions,
        is_anonymous: fullQuiz.is_anonymous,
      };
      const url = window.URL.createObjectURL(
        new Blob([JSON.stringify(downloadableQuiz, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${fullQuiz.title}.json`);
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Nie udało się pobrać quizu.");
    }
  };

  const updateQuiz = (quiz: QuizMetadata) => {
    setUserQuizzes((previous) =>
      previous.map((q) => (q.id === quiz.id ? quiz : q)),
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="space-y-2 pb-8 text-center">
            <p>Ładowanie quizów...</p>
            <Loader size={15} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error != null) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>{error}</AlertTitle>
      </Alert>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-2xl font-semibold">Twoje quizy</h3>

      {userQuizzes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {userQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              showEdit
              showShare
              showDownload
              showSearch={!appContext.isGuest}
              showDelete
              onShare={handleShareQuiz}
              onDelete={handleDeleteQuiz}
              onDownload={handleDownloadQuiz}
            />
          ))}
          <Card className="flex h-full flex-col" key="create-quiz">
            <CardHeader>
              <CardTitle className="text-muted-foreground text-base">
                Dodaj nowy quiz
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="flex items-center justify-between">
              <Link to="/create-quiz">
                <Button size="sm">
                  Stwórz
                  <PlusIcon />
                </Button>
              </Link>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/import-quiz">
                      <Button size="sm">
                        Importuj
                        <UploadIcon />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Importuj quiz z pliku JSON</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/import-quiz-legacy">
                      <Button size="sm">
                        <FolderArchiveIcon />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    Importuj quiz ze starego formatu
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground text-sm">
            Nie masz jeszcze żadnych quizów.
          </p>
          <Link to="/create-quiz">
            <Button>Stwórz quiz</Button>
          </Link>
        </div>
      )}

      {sharedQuizzes.length > 0 && (
        <>
          <h3 className="mt-8 mb-4 text-2xl font-semibold">
            Udostępnione quizy
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedQuizzes.map((sq) => (
              <QuizCard
                key={sq.id}
                quiz={sq.quiz}
                showEdit={Boolean(sq.quiz.can_edit)}
                showShare={false}
                showDownload
                showSearch
                showDelete={false}
                onDownload={handleDownloadQuiz}
              />
            ))}
          </div>
        </>
      )}
      <div className="p-5" />
      {currentDialog.type === "share" && currentDialog.quiz !== null && (
        <ShareQuizDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setCurrentDialog({ type: null, quiz: null });
            }
          }}
          quiz={currentDialog.quiz}
          setQuiz={updateQuiz}
        />
      )}
      <AlertDialog
        open={currentDialog.type === "delete"}
        onOpenChange={(open) => {
          setCurrentDialog({
            type: open ? "delete" : null,
            quiz: open ? currentDialog.quiz : null,
          });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź usunięcie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten quiz? Tej operacji nie można
              cofnąć! Ty oraz inni użytkownicy nie będą mogli już korzystać z
              tego quizu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQuiz}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
