import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router";
import AppContext from "../AppContext.tsx";
import { QuizMetadata } from "../components/quiz/types.ts";
import { SharedQuiz } from "../components/quiz/ShareQuizModal/types.ts";
import ShareQuizModal from "../components/quiz/ShareQuizModal/ShareQuizModal.tsx";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircleIcon,
  FolderArchiveIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import Loader from "@/components/loader.tsx";
import QuizCard from "@/components/quiz/QuizCard.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

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
        setUserQuizzes(
          localStorage.getItem("guest_quizzes")
            ? JSON.parse(localStorage.getItem("guest_quizzes")!)
            : [],
        );

        setLoading(false);
        return;
      }
      try {
        const [userResponse, sharedResponse] = await Promise.all([
          appContext.axiosInstance.get("/quizzes/"),
          appContext.axiosInstance.get("/shared-quizzes/"),
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

    fetchQuizzes();
  }, [appContext.axiosInstance]);

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
        setUserQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
        return;
      }
      appContext.axiosInstance
        .delete(`/quizzes/${quiz.id}/`)
        .then(() => {
          setUserQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
        })
        .catch(() => {
          setError("Nie udało się usunąć quizu.");
        });
    }
  };

  const handleDownloadQuiz = (quiz: QuizMetadata) => {
    if (appContext.isGuest) {
      // @ts-expect-error - we don't need the id in the downloaded quiz
      delete quiz.id;
      const url = window.URL.createObjectURL(
        new Blob([JSON.stringify(quiz, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${quiz.title}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    appContext.axiosInstance
      .get(`/quizzes/${quiz.id}/`)
      .then((response) => {
        const quiz = response.data;
        delete quiz.id;
        quiz.maintainer = quiz.maintainer?.full_name || null;
        delete quiz.visibility;
        delete quiz.allow_anonymous;
        const url = window.URL.createObjectURL(
          new Blob([JSON.stringify(quiz, null, 2)], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${quiz.title}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch(() => {
        setError("Nie udało się pobrać quizu.");
      });
  };

  const updateQuiz = (quiz: QuizMetadata) => {
    setUserQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? quiz : q)));
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
                showEdit={!!sq.quiz.can_edit}
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
      {selectedQuizToShare && (
        <ShareQuizModal
          show={true}
          onHide={() => setSelectedQuizToShare(null)}
          quiz={selectedQuizToShare}
          setQuiz={updateQuiz}
        />
      )}
    </div>
  );
};

export default QuizzesPage;
