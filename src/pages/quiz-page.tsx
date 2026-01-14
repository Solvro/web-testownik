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
import { computeAnswerVariant } from "@/components/quiz/helpers/question-card.ts";
import { useKeyShortcuts } from "@/components/quiz/hooks/use-key-shortcuts";
import type { QuizHistory } from "@/components/quiz/hooks/use-quiz-history.ts";
import { useQuizLogic } from "@/components/quiz/hooks/use-quiz-logic";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizActionButtons } from "@/components/quiz/quiz-action-buttons";
import { QuizInfoCard } from "@/components/quiz/quiz-info-card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { cn } from "@/lib/utils";

export function QuizPage(): React.JSX.Element {
  const { quizId } = useParams<{ quizId: string }>();
  const appContext = useContext(AppContext);
  const { loading, quiz, history, state, stats, continuity, actions } =
    useQuizLogic({
      quizId: quizId ?? "",
      appContext,
    });
  const {
    currentQuestion,
    selectedAnswers,
    questionChecked,
    isQuizFinished,
    canGoBack,
    isHistoryQuestion,
    showHistory,
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
    toggleHistory,
    toggleBrainrot,
  } = actions;

  useKeyShortcuts({
    nextAction,
    nextQuestion,
  });

  console.log(canGoBack);

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
            isHistoryQuestion={isHistoryQuestion}
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
            onToggleHistory={toggleHistory}
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
      <Dialog open={showHistory} onOpenChange={toggleHistory}>
        <DialogContent className="flex flex-col md:max-w-xl">
          <DialogHeader>
            <DialogTitle>Historia pytań</DialogTitle>
            <DialogDescription>
              Wybierz pytanie poniżej aby zobaczyć jego podgląd
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1 overflow-y-scroll">
            <div className="grid max-h-80 w-full flex-col gap-2">
              {canGoBack
                ? history
                    .slice(1, 30)
                    .map((historyEntry: QuizHistory, index: number) => {
                      const correctIndexes = historyEntry.question.answers
                        .map((a, answerIndex) => (a.correct ? answerIndex : -1))
                        .filter((answerIndex) => answerIndex !== -1);
                      const isCorrectQuestion =
                        correctIndexes.length === historyEntry.answers.length &&
                        correctIndexes.every((ci) =>
                          historyEntry.answers.includes(ci),
                        );
                      return (
                        <button
                          key={`answer-${index.toString()}`}
                          id={`answer-${index.toString()}`}
                          onClick={() => {
                            // handleAnswerClick(index);
                          }}
                          className={cn(
                            "w-full justify-start rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors",
                            computeAnswerVariant(
                              historyEntry.answers.length > 0,
                              true,
                              historyEntry.answers.length > 0
                                ? isCorrectQuestion
                                : true,
                            ),
                          )}
                        >
                          <span className="w-full">
                            {historyEntry.question.id}.{" "}
                            {historyEntry.question.question}
                          </span>
                        </button>
                      );
                    })
                : null}
            </div>
            <ScrollBar orientation="vertical"></ScrollBar>
          </ScrollArea>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Zamknij</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Continuity */}
      <ContinuityDialog
        peerConnections={peerConnections}
        isContinuityHost={isContinuityHost}
      />
    </>
  );
}
