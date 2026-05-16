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
import { AiExplainCard } from "@/components/ai/ai-explain-card";
import type { AnswerHint } from "@/components/ai/ai-explain-card";
import { BrainrotCard } from "@/components/quiz/brainrot-card";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  const showAi = hasAiAccess && !(quiz.user_settings?.ai_disabled ?? false);

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

  useKeyShortcuts({
    nextAction,
    skipQuestion,
    questionChecked,
    isHistoryQuestion,
    togglePreviousQuestion,
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
                  quizId={quiz.id}
                  question={currentQuestion}
                  selectedAnswers={selectedAnswers}
                  setSelectedAnswers={(newSelected) => {
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
                  togglePreviousQuestion={togglePreviousQuestion}
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
