"use client";

import { Icon } from "@iconify/react";
import { FileQuestionMarkIcon } from "lucide-react";
import Link from "next/link";
import {
  ViewTransition,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { AiChat } from "@/components/ai/ai-chat";
import type { AnswerHint } from "@/components/ai/ai-explain-card";
import { AiExplainCard } from "@/components/ai/ai-explain-card";
import { BrainrotCard } from "@/components/quiz/brainrot-card";
import { ContinuityDialog } from "@/components/quiz/continuity-dialog";
import { ExternalImageContext } from "@/components/quiz/external-image-context";
import { ExternalImageWarning } from "@/components/quiz/external-image-warning";
import { useExternalImageApproval } from "@/components/quiz/hooks/use-external-image-approval";
import { useFocusMode } from "@/components/quiz/hooks/use-focus-mode";
import { useKeyShortcuts } from "@/components/quiz/hooks/use-key-shortcuts";
import { useQuizLogic } from "@/components/quiz/hooks/use-quiz-logic";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizActionButtons } from "@/components/quiz/quiz-action-buttons";
import { QuizHistoryDialog } from "@/components/quiz/quiz-history-dialog";
import { QuizInfoCard } from "@/components/quiz/quiz-info-card";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { env } from "@/env";
import { PermissionAction } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

interface QuizPageClientProps {
  quizId: string;
}

function QuizPageContent({ quizId }: { quizId: string }): React.JSX.Element {
  const { user, checkPermission } = useContext(AppContext);
  const { quiz, state, stats, continuity, actions } = useQuizLogic({
    quizId,
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
  } = stats;
  const answers = quiz.current_session?.answers ?? [];
  const {
    isFocusModeActive,
    toggleFocusMode,
    resetInactivityTimer,
    isFocusAlertOpen,
    focusAlert,
    closeFocusAlert,
    turnOffFocusModeFromAlert,
    showOnboarding,
    confirmOnboarding,
    confirmOnboardingAndHide,
    cancelOnboarding,
  } = useFocusMode(timerStore);
  const { isHost: isContinuityHost, peerConnections } = continuity;
  const {
    nextAction,
    skipQuestion,
    resetProgress,
    setSelectedAnswers,
    toggleHistory,
    toggleBrainrot,
    togglePreviousQuestion,
  } = actions;

  const {
    isApproved: externalImagesApproved,
    isInitialized,
    domains: externalDomains,
    approve: approveExternalImages,
    hasExternalImages,
  } = useExternalImageApproval(quiz);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showAiExplain, setShowAiExplain] = useState(false);
  const [answerHints, setAnswerHints] = useState<AnswerHint[]>([]);

  const hasAiAccess = checkPermission(PermissionAction.AI_FEATURES);
  const showAi =
    env.NEXT_PUBLIC_AI_ENABLED &&
    hasAiAccess &&
    !(quiz.user_settings?.ai_disabled ?? false);

  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
  useEffect(() => {
    setShowAiExplain(false);
    setAnswerHints([]);
  }, [currentQuestion?.id]);
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  const handleToggleBrainrot = () => {
    startTransition(() => {
      toggleBrainrot();
    });
  };

  const handleQuizActivity = (action: () => void) => {
    resetInactivityTimer();
    action();
  };

  useKeyShortcuts({
    nextAction: () => {
      handleQuizActivity(nextAction);
    },
    skipQuestion: () => {
      handleQuizActivity(skipQuestion);
    },
    questionChecked,
    isHistoryQuestion,
    togglePreviousQuestion: () => {
      handleQuizActivity(togglePreviousQuestion);
    },
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
              <Link href="/profile?tab=settings" className="underline">
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

      <AlertDialog
        open={isFocusAlertOpen}
        onOpenChange={(open: boolean) => {
          if (!open) {
            closeFocusAlert();
          }
        }}
      >
        <AlertDialogContent
          className="border-destructive ring-destructive/20 border ring-5"
          overlayClassName="after:bg-destructive/10 after:backdrop-blur-sm after:h-full after:w-full after:fixed after:inset-0 after:animate-pulse"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              {focusAlert.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {focusAlert.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogAction
              variant="secondary"
              onClick={turnOffFocusModeFromAlert}
            >
              Wyłącz tryb skupienia
            </AlertDialogAction>
            <AlertDialogAction onClick={closeFocusAlert}>
              Wracam do nauki
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showOnboarding}
        onOpenChange={(open: boolean) => {
          if (!open) {
            cancelOnboarding();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czym jest tryb skupienia?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-1 text-base">
              Tryb skupienia to funkcja, która pomaga Ci skoncentrować się na
              quizie.
              <span className="mt-2 block">
                <strong>Jak to działa? </strong>
                Po włączeniu tego trybu, jeśli opuścisz tę kartę lub nie
                wykonasz żadnej akcji przez 5 minut, timer zostanie
                automatycznie zatrzymany, a aplikacja odtworzy głośny dźwięk i
                pokaże powiadomienie przypominające o powrocie do nauki.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="secondary"
              onClick={confirmOnboardingAndHide}
              className="sm:mr-auto"
            >
              OK, nie pokazuj ponownie
            </AlertDialogAction>
            <AlertDialogCancel onClick={cancelOnboarding}>
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmOnboarding}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid touch-manipulation grid-cols-1 gap-4 lg:grid-cols-4">
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-3",
            showBrainrot ? "lg:col-span-3" : "lg:col-span-4",
          )}
        >
          <div className="min-w-0 lg:col-span-2">
            <ViewTransition
              name={`quiz-open-${quiz.id}-${quiz.folder?.id ?? ""}`}
              update="h-full"
            >
              {quiz.questions.length === 0 ? (
                <Card>
                  <CardContent>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FileQuestionMarkIcon />
                        </EmptyMedia>
                        <EmptyTitle>Brak pytań</EmptyTitle>
                        <EmptyDescription>
                          W tym quizie nie ma jeszcze żadnych pytań.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </CardContent>
                </Card>
              ) : (
                <QuestionCard
                  quiz={quiz}
                  question={currentQuestion}
                  selectedAnswers={selectedAnswers}
                  setSelectedAnswers={(newSelected) => {
                    resetInactivityTimer();
                    // If question is not multiple, unselect everything except the new
                    if (currentQuestion !== null && !currentQuestion.multiple) {
                      setSelectedAnswers(
                        newSelected.length > 0 ? [newSelected[0]] : [],
                      );
                    } else {
                      setSelectedAnswers(newSelected);
                    }
                  }}
                  nextAction={() => {
                    handleQuizActivity(nextAction);
                  }}
                  answers={answers}
                  questionChecked={questionChecked}
                  isQuizFinished={isQuizFinished}
                  restartQuiz={resetProgress}
                  togglePreviousQuestion={() => {
                    handleQuizActivity(togglePreviousQuestion);
                  }}
                  isHistoryQuestion={isHistoryQuestion}
                  canGoBack={canGoBack}
                  answerHints={answerHints}
                />
              )}
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
                isFocusModeActive={isFocusModeActive}
                toggleFocusMode={toggleFocusMode}
              />
              <QuizActionButtons
                quiz={quiz}
                question={currentQuestion}
                onToggleHistory={toggleHistory}
                onToggleBrainrot={handleToggleBrainrot}
                onExplain={() => {
                  setShowAiExplain(true);
                }}
                disabled={isQuizFinished || currentQuestion == null}
                isExplainOpen={showAiExplain}
                aiDisabled={!showAi}
              />
              {showAi && showAiExplain && currentQuestion != null ? (
                <AiExplainCard
                  question={currentQuestion}
                  questionChecked={questionChecked}
                  onClose={() => {
                    setShowAiExplain(false);
                    setAnswerHints([]);
                  }}
                  onAnswerHints={setAnswerHints}
                />
              ) : null}
            </div>
          </ViewTransition>
        </div>
        {showBrainrot ? <BrainrotCard /> : null}
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

      {showAi ? (
        <AiChat
          open={isChatOpen}
          onOpenChange={setIsChatOpen}
          quizId={quiz.id}
          quiz={{ title: quiz.title, description: quiz.description }}
          question={currentQuestion}
          questions={quiz.questions}
          userName={user?.first_name}
          canEdit={
            (quiz.can_edit ?? false) || quiz.creator?.id === user?.user_id
          }
        />
      ) : null}
    </ExternalImageContext.Provider>
  );
}

export function QuizPageClient({ quizId }: QuizPageClientProps) {
  return <QuizPageContent quizId={quizId} />;
}
