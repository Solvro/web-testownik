"use client";

import { Icon } from "@iconify/react";
import { LogInIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { ViewTransition, startTransition, useContext, useEffect } from "react";
import ReactPlayer from "react-player";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Loader } from "@/components/loader";
import { LoginPrompt } from "@/components/login-prompt";
import { ContinuityDialog } from "@/components/quiz/continuity-dialog";
import { useKeyShortcuts } from "@/components/quiz/hooks/use-key-shortcuts";
import { useQuizLogic } from "@/components/quiz/hooks/use-quiz-logic";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizActionButtons } from "@/components/quiz/quiz-action-buttons";
import { QuizHistoryDialog } from "@/components/quiz/quiz-history-dialog";
import { QuizInfoCard } from "@/components/quiz/quiz-info-card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuizPageClientProps {
  quizId: string;
}

function QuizPageContent({ quizId }: { quizId: string }): React.JSX.Element {
  const appContext = useContext(AppContext);
  const { loading, quiz, state, stats, continuity, actions } = useQuizLogic({
    quizId,
    appContext,
  });
  const {
    currentQuestion,
    selectedAnswers,
    questionChecked,
    isQuizFinished,
    isHistoryQuestion,
    canGoBack,
    showHistory,
    showBrainrot,
  } = state;
  const {
    correctAnswersCount,
    wrongAnswersCount,
    masteredCount,
    totalQuestions,
    timerStore,
    answers,
  } = stats;
  const { isHost: isContinuityHost, peerConnections } = continuity;
  const {
    nextAction,
    skipQuestion,
    resetProgress,
    setSelectedAnswers,
    toggleHistory,
    toggleBrainrot,
    openHistoryQuestion,
  } = actions;

  const handleToggleHistory = () => {
    startTransition(() => {
      toggleHistory();
    });
  };

  const handleToggleBrainrot = () => {
    startTransition(() => {
      toggleBrainrot();
    });
  };

  useKeyShortcuts({
    nextAction,
    skipQuestion,
  });

  useEffect(() => {
    if (loading || quiz === null) {
      return;
    }

    if (localStorage.getItem("shown_reoccurrences_info") === null) {
      toast.info("Informacja o powtórzeniach", {
        description: (
          <div className="space-y-1">
            <p>
              Domyślnie pytania mają 1 powtórzenie i dodatkowe powtórzenia po
              błędnej odpowiedzi.
            </p>
            <p>
              Możesz zmienić to w{" "}
              <Link href="/profile#settings" className="underline">
                ustawieniach
              </Link>
              .
            </p>
          </div>
        ),
        icon: <Icon icon="mdi:settings" />,
        duration: 10_000,
      });
      localStorage.setItem("shown_reoccurrences_info", "true");
    }
  }, [loading, quiz]);

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
                <Link href="/connect-account">
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

  return (
    <>
      <div className="grid touch-manipulation grid-cols-1 gap-4 lg:grid-cols-4">
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-3",
            showBrainrot ? "lg:col-span-3" : "lg:col-span-4",
          )}
        >
          <div className="lg:col-span-2">
            <ViewTransition name={`quiz-open-${quiz.id}`} update="h-full">
              <QuestionCard
                quizId={quiz.id}
                question={currentQuestion}
                selectedAnswers={selectedAnswers}
                setSelectedAnswers={(newSelected) => {
                  // If question is not multiple, unselect everything except the new
                  if (currentQuestion !== null && !currentQuestion.multiple) {
                    setSelectedAnswers(
                      newSelected.length > 0 ? [newSelected[0]] : [],
                    );
                  } else {
                    setSelectedAnswers(newSelected);
                  }
                }}
                questionChecked={questionChecked}
                nextAction={nextAction}
                isQuizFinished={isQuizFinished}
                restartQuiz={resetProgress}
                answers={answers}
                openHistoryQuestion={openHistoryQuestion}
                isHistoryQuestion={isHistoryQuestion}
                canGoBack={canGoBack}
              />
            </ViewTransition>
          </div>
          <ViewTransition name="quiz-info">
            <div className="flex flex-col gap-4 lg:col-span-1">
              <QuizInfoCard
                quiz={quiz}
                correctAnswersCount={correctAnswersCount}
                wrongAnswersCount={wrongAnswersCount}
                masteredCount={masteredCount}
                totalQuestions={totalQuestions}
                timerStore={timerStore}
                resetProgress={resetProgress}
              />
              <QuizActionButtons
                quiz={quiz}
                question={currentQuestion}
                onToggleHistory={handleToggleHistory}
                onToggleBrainrot={handleToggleBrainrot}
                disabled={isQuizFinished || currentQuestion == null}
              />
            </div>
          </ViewTransition>
        </div>
        {showBrainrot ? (
          <div className="animate-in fade-in slide-in-from-right duration-300">
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

      <QuizHistoryDialog
        quiz={quiz}
        answers={answers}
        showHistory={showHistory}
        toggleHistory={toggleHistory}
        openHistoryQuestion={openHistoryQuestion}
      />

      {/* Continuity */}
      <ContinuityDialog
        peerConnections={peerConnections}
        isContinuityHost={isContinuityHost}
      />
    </>
  );
}

export function QuizPageClient({ quizId }: QuizPageClientProps) {
  return <QuizPageContent quizId={quizId} />;
}
