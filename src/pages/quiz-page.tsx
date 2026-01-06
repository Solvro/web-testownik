import { Icon } from "@iconify/react";
import { LogInIcon, RotateCcwIcon } from "lucide-react";
import React, { useContext } from "react";
import ReactPlayer from "react-player";
import { Link, useParams } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { Loader } from "@/components/loader";
import { LoginPrompt } from "@/components/login-prompt";
import { ContinuityDialog } from "@/components/quiz/continuity-dialog";
import { useKeyShortcuts } from "@/components/quiz/hooks/use-key-shortcuts";
import { useQuizLogic } from "@/components/quiz/hooks/use-quiz-logic";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizActionButtons } from "@/components/quiz/quiz-action-buttons";
import { QuizInfoCard } from "@/components/quiz/quiz-info-card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function QuizPage(): React.JSX.Element {
  const { quizId } = useParams<{ quizId: string }>();
  const appContext = useContext(AppContext);
  const { loading, quiz, state, stats, continuity, actions } = useQuizLogic({
    quizId: quizId ?? "",
    appContext,
  });
  const {
    currentQuestion,
    selectedAnswers,
    questionChecked,
    isQuizFinished,
    canGoBack,
    isPreviousQuestion,
    showBrainrot,
  } = state;
  const { correctAnswersCount, wrongAnswersCount, reoccurrences, studyTime } =
    stats;
  const { isHost: isContinuityHost, peerConnections } = continuity;
  const {
    nextAction,
    goBack,
    nextQuestion,
    resetProgress,
    setSelectedAnswers,
    toggleBrainrot,
  } = actions;

  useKeyShortcuts({
    nextAction,
    nextQuestion,
  });

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

  if (quiz === null) {
    if (!appContext.isAuthenticated && !appContext.isGuest) {
      return <LoginPrompt />;
    }
    if (appContext.isGuest) {
      return (
        <Card>
          <CardContent>
            <div className="space-y-3 text-center">
              <p>Quiz nie został znaleziony lub nie jest dostępny dla gości.</p>
              <p>
                Możesz spróbować się zalogować, aby uzyskać dostęp do tego
                quizu, lub skontaktować się z jego twórcą aby ustawić
                dostępność.
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => {
                    window.location.reload();
                  }}
                  variant="outline"
                >
                  <RotateCcwIcon /> Spróbuj ponownie
                </Button>
                <Link to="/connect-account">
                  <Button>
                    <LogInIcon />
                    Zaloguj się
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <div className="space-y-3 text-center">
            <p>
              Nie udało się załadować quizu, upewnij się że jest on dla Ciebie
              dostępny lub spróbuj ponownie później.
            </p>
            <Button
              onClick={() => {
                window.location.reload();
              }}
              variant="outline"
            >
              <RotateCcwIcon /> Spróbuj ponownie
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (localStorage.getItem("shown_reoccurrences_info") === null) {
    toast.info(
      <div>
        <p>
          Domyślnie pytania mają 1 powtórzenie i dodatkowe powtórzenia po
          błędnej odpowiedzi.
        </p>
        <p>
          Możesz zmienić to w <Link to="/profile#settings">ustawieniach</Link>.
        </p>
      </div>,
      { icon: () => <Icon icon="mdi:settings" />, autoClose: 10_000 },
    );
    localStorage.setItem("shown_reoccurrences_info", "true");
  }

  return (
    <>
      <div className="mt-4 grid touch-manipulation grid-cols-1 gap-4 lg:grid-cols-12">
        <div
          className={cn(
            "order-1",
            showBrainrot ? "lg:col-span-6" : "lg:col-span-8",
          )}
        >
          <QuestionCard
            question={currentQuestion}
            selectedAnswers={selectedAnswers}
            setSelectedAnswers={(newSelected) => {
              // If question is not multiple, unselect everything except the new
              if (currentQuestion !== null && !currentQuestion.multiple) {
                setSelectedAnswers(
                  newSelected.length > 0 ? [newSelected[0]] : [],
                );
                // Also broadcast to peers
                // broadcast handled inside logic hook if needed
              } else {
                setSelectedAnswers(newSelected);
                // If multiple, broadcast each toggle
                // broadcast handled inside logic hook
              }
            }}
            questionChecked={questionChecked}
            nextAction={nextAction}
            goBack={goBack}
            canGoBack={canGoBack}
            isPreviousQuestion={isPreviousQuestion}
            isQuizFinished={isQuizFinished}
            restartQuiz={resetProgress}
          />
        </div>
        <div
          className={cn(
            "order-2 flex flex-col gap-4",
            showBrainrot ? "lg:col-span-3" : "lg:col-span-4",
          )}
        >
          <QuizInfoCard
            quiz={quiz}
            correctAnswersCount={correctAnswersCount}
            wrongAnswersCount={wrongAnswersCount}
            reoccurrences={reoccurrences}
            studyTime={studyTime}
            resetProgress={resetProgress}
          />
          <QuizActionButtons
            quiz={quiz}
            question={currentQuestion}
            onToggleBrainrot={toggleBrainrot}
            disabled={isQuizFinished || currentQuestion == null}
          />
        </div>
        {showBrainrot ? (
          <div className="order-3 lg:col-span-3">
            <Card>
              <CardContent>
                <AspectRatio
                  ratio={9 / 20}
                  className="overflow-hidden rounded-md"
                >
                  <ReactPlayer
                    className="min-w-0"
                    src="https://www.youtube.com/watch?v=zZ7AimPACzc"
                    playing
                    playsInline
                    loop
                    muted
                    width="100%"
                    height="100%"
                  />
                </AspectRatio>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {/* Continuity */}
      <ContinuityDialog
        peerConnections={peerConnections}
        isContinuityHost={isContinuityHost}
      />
    </>
  );
}
