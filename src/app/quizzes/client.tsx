"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, PlusIcon, UploadIcon, XIcon } from "lucide-react";
import Link from "next/link";
import {
  ViewTransition,
  startTransition,
  useContext,
  useMemo,
  useState,
} from "react";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context";
import { Loader } from "@/components/loader";
import { QuizCard } from "@/components/quiz/quiz-card";
import { QuizSort } from "@/components/quiz/quiz-sort";
import { ShareQuizDialog } from "@/components/quiz/share-quiz-dialog/share-quiz-dialog";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSharedQuizzes, useUserQuizzes } from "@/hooks/use-quizzes";
import type { QuizMetadata, SharedQuiz } from "@/types/quiz";

interface QuizzesPageContentProps {
  userId?: string;
  isGuest: boolean;
}

function QuizzesPageContent({ userId, isGuest }: QuizzesPageContentProps) {
  const appContext = useContext(AppContext);
  const queryClient = useQueryClient();

  const {
    data: userQuizzes = [],
    isLoading: isLoadingUserQuizzes,
    error: userQuizzesError,
  } = useUserQuizzes(isGuest);

  const {
    data: allSharedQuizzes = [],
    isLoading: isLoadingSharedQuizzes,
    error: sharedQuizzesError,
  } = useSharedQuizzes(isGuest);

  // Filter shared quizzes to get unique ones
  const sharedQuizzes = useMemo(() => {
    return allSharedQuizzes.filter(
      (sq: SharedQuiz, index: number, self: SharedQuiz[]) =>
        index === self.findIndex((q) => q.quiz.id === sq.quiz.id) &&
        sq.quiz.maintainer?.id !== userId,
    );
  }, [allSharedQuizzes, userId]);

  const loading = isLoadingUserQuizzes || isLoadingSharedQuizzes;
  const error = userQuizzesError ?? sharedQuizzesError;

  const emptyComparator = (
    _a: QuizMetadata | SharedQuiz,
    _b: QuizMetadata | SharedQuiz,
  ) => 0;

  const [currentDialog, setCurrentDialog] = useState<{
    type: "share" | "delete" | null;
    quiz: QuizMetadata | null;
  }>({ type: null, quiz: null });
  const [quizRegex, setQuizRegex] = useState<RegExp>(/.*/);
  const [quizComparator, setQuizComparator] = useState<
    (a: QuizMetadata | SharedQuiz, b: QuizMetadata | SharedQuiz) => number
  >(() => emptyComparator);

  const sortedUserQuizzes: QuizMetadata[] = useMemo(() => {
    return userQuizzes.toSorted(quizComparator);
  }, [userQuizzes, quizComparator]);

  const filteredUserQuizes: QuizMetadata[] = sortedUserQuizzes.filter((quiz) =>
    quizRegex.test(quiz.title),
  );

  const sortedSharedQuizzes: SharedQuiz[] = useMemo(() => {
    return sharedQuizzes.toSorted(quizComparator);
  }, [sharedQuizzes, quizComparator]);

  const filteredSharedQuizes: SharedQuiz[] = sortedSharedQuizzes.filter(
    (quiz) => quizRegex.test(quiz.quiz.title),
  );

  if (typeof document !== "undefined") {
    document.title = "Twoje quizy - Testownik Solvro";
  }

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
      void queryClient.invalidateQueries({
        queryKey: ["user-quizzes"],
      });
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
    queryClient.setQueryData(
      ["user-quizzes", isGuest],
      (old: QuizMetadata[] | undefined) => {
        return old === undefined
          ? []
          : old.map((q) => (q.id === quiz.id ? quiz : q));
      },
    );
  };

  const handleSortQuizzes = (
    comparator: (
      a: QuizMetadata | SharedQuiz,
      b: QuizMetadata | SharedQuiz,
    ) => number,
  ) => {
    startTransition(() => {
      setQuizComparator(() => comparator);
    });
  };

  const handleFilterQuizzes = (value: string) => {
    value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    startTransition(() => {
      setQuizRegex(value ? new RegExp(value, "i") : /.*/);
    });
  };

  const [resetFiltersTrigger, setResetFiltersTrigger] = useState(0);

  const handleResetFilters = () => {
    startTransition(() => {
      setQuizComparator(() => emptyComparator);
      setQuizRegex(/.*/);
      setResetFiltersTrigger((n) => n + 1);
    });
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
        <AlertTitle>{error.message}</AlertTitle>
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row">
        <h3 className="text-2xl font-semibold">Twoje quizy</h3>
        <QuizSort
          key={resetFiltersTrigger}
          onSortChange={handleSortQuizzes}
          onNameFilterChange={handleFilterQuizzes}
          onResetFilters={handleResetFilters}
        />
      </div>
      {filteredUserQuizes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ViewTransition>
            {filteredUserQuizes.map((quiz) => (
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
              <CardFooter className="mt-auto flex items-center justify-between">
                <ViewTransition name="create-quiz">
                  <Link href="/create-quiz">
                    <Button size="sm">
                      Stwórz
                      <PlusIcon />
                    </Button>
                  </Link>
                </ViewTransition>
                <div className="flex gap-1">
                  <ViewTransition name="import-quiz">
                    <Link href="/import-quiz">
                      <Button size="sm">
                        Importuj
                        <UploadIcon />
                      </Button>
                    </Link>
                  </ViewTransition>
                </div>
              </CardFooter>
            </Card>
          </ViewTransition>
        </div>
      ) : userQuizzes.length > 0 ? (
        <ViewTransition>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nie znaleźliśmy quizu, którego szukasz</EmptyTitle>
              <EmptyDescription>
                Usuń albo zmień wybrane filtry, aby znaleźć inne quizy.
                <br />
                Albo utwórz lub importuj nowy quiz.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex flex-row">
              <Button onClick={handleResetFilters} variant="outline">
                Wyczyść Filtry <XIcon />
              </Button>
              <ViewTransition name="create-quiz">
                <Link href="/create-quiz">
                  <Button>
                    Stwórz quiz <PlusIcon />
                  </Button>
                </Link>
              </ViewTransition>
              <ViewTransition name="import-quiz">
                <Link href="/import-quiz">
                  <Button>
                    Importuj
                    <UploadIcon />
                  </Button>
                </Link>
              </ViewTransition>
            </EmptyContent>
          </Empty>
        </ViewTransition>
      ) : (
        <ViewTransition>
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground text-sm">
              Nie masz jeszcze żadnych quizów.
            </p>
            <Link href="/create-quiz">
              <Button>Stwórz quiz</Button>
            </Link>
          </div>
        </ViewTransition>
      )}

      {filteredSharedQuizes.length > 0 && (
        <>
          <h3 className="mt-8 mb-4 text-2xl font-semibold">
            Udostępnione quizy
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ViewTransition>
              {filteredSharedQuizes.map((sq) => (
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
            </ViewTransition>
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

export function QuizzesPageClient({
  userId,
  isGuest,
}: QuizzesPageContentProps) {
  return <QuizzesPageContent userId={userId} isGuest={isGuest} />;
}
