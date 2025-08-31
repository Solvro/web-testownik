import {
  AlertCircleIcon,
  FolderArchiveIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router";

import Loader from "@/components/loader.tsx";
import QuizCard from "@/components/quiz/quiz-card.tsx";
import { Alert, AlertTitle } from "@/components/ui/alert";
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

import AppContext from "../app-context.tsx";
import ShareQuizModal from "../components/quiz/ShareQuizModal/share-quiz-modal.tsx";
import type { SharedQuiz } from "../components/quiz/ShareQuizModal/types.ts";
import type { QuizMetadata } from "../components/quiz/types.ts";

const QuizzesPage: React.FC = () => {
  const appContext = useContext(AppContext);

  const [userQuizzes, setUserQuizzes] = useState<QuizMetadata[]>([]);
  const [sharedQuizzes, setSharedQuizzes] = useState<SharedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuizToShare, setSelectedQuizToShare] =
    useState<QuizMetadata | null>(null);

  document.title = "Twoje quizy - Testownik Solvro";

  useEffect(() => {
    const fetchQuizzes = async () => {
      if (appContext.isGuest) {
        const guestQuizzesString = localStorage.getItem("guest_quizzes");
        setUserQuizzes(
          guestQuizzesString !== null
            ? (JSON.parse(guestQuizzesString) as QuizMetadata[])
            : [],
        );

        setLoading(false);
        return;
      }
      try {
        const [userResponse, sharedResponse] = await Promise.all([
          appContext.axiosInstance.get<QuizMetadata[]>("/quizzes/"),
          appContext.axiosInstance.get<SharedQuiz[]>("/shared-quizzes/"),
        ]);

        if (userResponse.status === 200) {
          setUserQuizzes(userResponse.data);
        }

        if (sharedResponse.status === 200) {
          const uniqueSharedQuizzes = sharedResponse.data.filter(
            (sq: SharedQuiz, index: number, self: SharedQuiz[]) =>
              index === self.findIndex((q) => q.quiz.id === sq.quiz.id) &&
              sq.quiz.maintainer?.id !== localStorage.getItem("user_id"),
          );
          setSharedQuizzes(uniqueSharedQuizzes);
        }
      } catch {
        setError("Nie udało się załadować quizów.");
      } finally {
        setLoading(false);
      }
    };

    void fetchQuizzes();
  }, [appContext.axiosInstance, appContext.isGuest]);

  const handleShareQuiz = (quiz: QuizMetadata) => {
    setSelectedQuizToShare(quiz);
  };

  const handleDeleteQuiz = (quiz: QuizMetadata) => {
    // Ask for confirmation  and then delete the quiz
    if (
      window.confirm(
        "Czy na pewno chcesz usunąć ten quiz?\nTej operacji nie można cofnąć!\n\nTy oraz inni użytkownicy nie będą mogli już korzystać z tego quizu.",
      )
    ) {
      if (appContext.isGuest) {
        localStorage.setItem(
          "guest_quizzes",
          JSON.stringify(userQuizzes.filter((q) => q.id !== quiz.id)),
        );
        setUserQuizzes((previous) => previous.filter((q) => q.id !== quiz.id));
        return;
      }
      appContext.axiosInstance
        .delete(`/quizzes/${quiz.id}/`)
        .then(() => {
          setUserQuizzes((previous) =>
            previous.filter((q) => q.id !== quiz.id),
          );
        })
        .catch(() => {
          setError("Nie udało się usunąć quizu.");
        });
    }
  };

  const handleDownloadQuiz = (quiz: QuizMetadata) => {
    if (appContext.isGuest) {
      // Create a copy without the id for download
      const { id, ...quizToDownload } = quiz;
      const url = window.URL.createObjectURL(
        new Blob([JSON.stringify(quizToDownload, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${quiz.title}.json`);
      document.body.append(link);
      link.click();
      link.remove();
      return;
    }
    void appContext.axiosInstance
      .get<Quiz>(`/quizzes/${quiz.id}/`)
      .then((response) => {
        const fullQuiz = response.data;
        // Create a downloadable version
        const downloadableQuiz = {
          title: fullQuiz.title,
          description: fullQuiz.description,
          maintainer: fullQuiz.maintainer?.full_name || null,
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
      })
      .catch(() => {
        setError("Nie udało się pobrać quizu.");
      });
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

  if (error) {
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
      {selectedQuizToShare ? (
        <ShareQuizModal
          show={true}
          onHide={() => {
            setSelectedQuizToShare(null);
          }}
          quiz={selectedQuizToShare}
          setQuiz={updateQuiz}
        />
      ) : null}
    </div>
  );
};

export default QuizzesPage;
