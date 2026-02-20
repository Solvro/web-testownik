"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { ViewTransition, startTransition, useContext, useEffect } from "react";
import ReactPlayer from "react-player";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { ContinuityDialog } from "@/components/quiz/continuity-dialog";
import { ExternalImageContext } from "@/components/quiz/external-image-context";
import { ExternalImageWarning } from "@/components/quiz/external-image-warning";
import { useExternalImageApproval } from "@/components/quiz/hooks/use-external-image-approval";
import { useKeyShortcuts } from "@/components/quiz/hooks/use-key-shortcuts";
import { useQuizLogic } from "@/components/quiz/hooks/use-quiz-logic";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizActionButtons } from "@/components/quiz/quiz-action-buttons";
import { QuizHistoryDialog } from "@/components/quiz/quiz-history-dialog";
import { QuizInfoCard } from "@/components/quiz/quiz-info-card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuizPageClientProps {
  quizId: string;
}

function QuizPageContent({ quizId }: { quizId: string }): React.JSX.Element {
  const appContext = useContext(AppContext);
  const { quiz, state, stats, continuity, actions } = useQuizLogic({
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
    goToPreviousQuestion,
  } = actions;

  const {
    isApproved: externalImagesApproved,
    isInitialized,
    domains: externalDomains,
    approve: approveExternalImages,
    hasExternalImages,
  } = useExternalImageApproval(quiz);

  const handleToggleBrainrot = () => {
    startTransition(() => {
      toggleBrainrot();
    });
  };

  useKeyShortcuts({
    nextAction,
    skipQuestion,
    isHistoryQuestion,
  });

  useEffect(() => {
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
  }, [quiz]);

  return (
    <ExternalImageContext.Provider
      value={{ externalImagesApproved, isInitialized }}
    >
      {isInitialized && hasExternalImages && !externalImagesApproved ? (
        <ExternalImageWarning
          domains={externalDomains}
          onApprove={approveExternalImages}
        />
      ) : null}

      <div className="grid touch-manipulation grid-cols-1 gap-4 lg:grid-cols-4">
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-3",
            showBrainrot ? "lg:col-span-3" : "lg:col-span-4",
          )}
        >
          <div className="min-w-0 lg:col-span-2">
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
                answers={answers}
                questionChecked={questionChecked}
                nextAction={nextAction}
                isQuizFinished={isQuizFinished}
                restartQuiz={resetProgress}
                goToPreviousQuestion={goToPreviousQuestion}
                isHistoryQuestion={isHistoryQuestion}
                canGoBack={canGoBack}
              />
            </ViewTransition>
          </div>
          <ViewTransition name="quiz-info" update="h-full">
            <div className="flex h-fit flex-col gap-4 lg:col-span-1">
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
                onToggleHistory={toggleHistory}
                onToggleBrainrot={handleToggleBrainrot}
                disabled={isQuizFinished || currentQuestion == null}
              />
            </div>
          </ViewTransition>
        </div>
        {showBrainrot ? (
          <div className="animate-in fade-in lg:slide-in-from-right duration-300">
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
      />

      {/* Continuity */}
      <ContinuityDialog
        peerConnections={peerConnections}
        isContinuityHost={isContinuityHost}
      />
    </ExternalImageContext.Provider>
  );
}

export function QuizPageClient({ quizId }: QuizPageClientProps) {
  return <QuizPageContent quizId={quizId} />;
}
