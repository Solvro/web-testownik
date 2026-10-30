"use client";

import {
  ArrowLeftIcon,
  FileQuestionMarkIcon,
  PartyPopperIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { FlashcardCard } from "@/components/quiz/flashcard-card";
import { useQuizLogic } from "@/components/quiz/hooks/use-quiz-logic";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { env } from "@/env";
import { PermissionAction } from "@/lib/auth/permissions";

/**
 * The quiz as a deck of flashcards. It shares the quiz's session: a card
 * graded here counts like an answer in the quiz, so progress, statistics and
 * history are the same on both pages.
 */
export function FlashcardsPageClient({ quizId }: { quizId: string }) {
  const { checkPermission } = useContext(AppContext);
  const { quiz, state, stats, actions } = useQuizLogic({ quizId });
  const showAi =
    env.NEXT_PUBLIC_AI_ENABLED &&
    checkPermission(PermissionAction.AI_FEATURES) &&
    !(quiz.user_settings?.ai_disabled ?? false);
  const { currentQuestion, isQuizFinished } = state;
  const { masteredCount, totalQuestions } = stats;
  const { gradeSelf, resetProgress } = actions;
  const answers = quiz.current_session?.answers ?? [];
  const progress =
    totalQuestions === 0
      ? 0
      : Math.round((masteredCount / totalQuestions) * 100);
  // One appearance of a question in this session: a repeated question gets
  // a fresh card, face up and in place.
  const attemptKey =
    currentQuestion === null
      ? null
      : `${quiz.current_session?.id ?? "local"}:${currentQuestion.id}:${String(answers.length)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center gap-3">
        <ButtonLink
          variant="outline"
          size="icon"
          href={`/quiz/${quizId}`}
          aria-label={`Powrót do quizu ${quiz.title}`}
        >
          <ArrowLeftIcon className="size-4" />
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-sm">Fiszki</p>
          <h1 className="truncate text-2xl font-bold">{quiz.title}</h1>
        </div>
      </header>

      {totalQuestions === 0 ? null : (
        <div className="flex items-center gap-3 text-sm">
          <Progress
            value={progress}
            className="flex-1"
            aria-label="Opanowane pytania"
          />
          <span className="text-muted-foreground tabular-nums">
            {masteredCount} / {totalQuestions} opanowane
          </span>
        </div>
      )}

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
      ) : isQuizFinished || currentQuestion === null ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PartyPopperIcon />
                </EmptyMedia>
                <EmptyTitle>Wszystkie fiszki opanowane</EmptyTitle>
                <EmptyDescription>
                  Możesz zacząć od nowa albo wrócić do quizu.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void resetProgress();
                    }}
                  >
                    <RotateCcwIcon />
                    Zacznij od nowa
                  </Button>
                  <ButtonLink href={`/quiz/${quizId}`}>
                    Wróć do quizu
                  </ButtonLink>
                </div>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <FlashcardCard
          key={attemptKey}
          question={currentQuestion}
          answers={answers}
          ai={
            showAi
              ? { defaultModel: quiz.user_settings?.default_ai_model ?? null }
              : null
          }
          onGrade={(knew) => {
            gradeSelf(knew, currentQuestion.id);
          }}
        />
      )}
    </div>
  );
}
