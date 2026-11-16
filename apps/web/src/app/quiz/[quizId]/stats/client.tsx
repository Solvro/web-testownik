"use client";

import { ArrowLeftIcon } from "lucide-react";

import { Loader } from "@/components/loader";
import { HardestQuestionsChart } from "@/components/quiz/stats/hardest-questions-chart";
import { HourlyChart } from "@/components/quiz/stats/hourly-chart";
import { ScoreChart } from "@/components/quiz/stats/score-chart";
import { SessionsChart } from "@/components/quiz/stats/sessions-chart";
import { StatsCardErrorBoundaryGroup } from "@/components/quiz/stats/stats-card-error-boundary";
import { StatsInfoCard } from "@/components/quiz/stats/stats-info-card";
import { StatsTable } from "@/components/quiz/stats/stats-table";
import { StudyTimeChart } from "@/components/quiz/stats/study-time-chart";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuizMetadata, useQuizStats } from "@/hooks/use-quiz-stats";

interface StatsPageClientProps {
  quizId: string;
}

export function StatsPageClient({ quizId }: StatsPageClientProps) {
  const { data: quiz, error, isFetching, refetch } = useQuizMetadata(quizId);
  const { data: myStats } = useQuizStats(quizId, "me");

  if (quiz === undefined) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          {error === null ? (
            <div
              role="status"
              className="flex items-center justify-center gap-3"
            >
              <Loader size={15} />
              Ładowanie statystyk…
            </div>
          ) : (
            <>
              <p role="alert">Nie udało się wczytać statystyk.</p>
              <Button disabled={isFetching} onClick={() => void refetch()}>
                {isFetching ? "Ładowanie…" : "Spróbuj ponownie"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const canViewAll = quiz.can_edit === true;

  return (
    <div className="space-y-4">
      {/* The mobile app shows its own native navigation bar above the embed. */}
      <div className="flex items-center gap-3 [[data-mobile-embed=true]_&]:hidden">
        <ButtonLink
          variant="outline"
          size="icon"
          href={`/quiz/${quizId}`}
          aria-label={`Powrót do quizu ${quiz.title}`}
        >
          <ArrowLeftIcon className="size-4" />
        </ButtonLink>
        <h1 className="text-2xl font-bold">Statystyki: {quiz.title}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatsCardErrorBoundaryGroup resetKeys={[quizId]}>
          <StatsInfoCard
            quiz={quiz}
            lastActivityAt={myStats?.last_activity_at ?? null}
          />
          <StatsTable quizId={quizId} canViewAll={canViewAll} />
        </StatsCardErrorBoundaryGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatsCardErrorBoundaryGroup resetKeys={[quizId]}>
          <SessionsChart quizId={quizId} canViewAll={canViewAll} />
          <HourlyChart quizId={quizId} canViewAll={canViewAll} />
          <ScoreChart quizId={quizId} canViewAll={canViewAll} />
          <StudyTimeChart quizId={quizId} canViewAll={canViewAll} />
        </StatsCardErrorBoundaryGroup>
      </div>

      <StatsCardErrorBoundaryGroup resetKeys={[quizId]}>
        <HardestQuestionsChart quizId={quizId} canViewAll={canViewAll} />
      </StatsCardErrorBoundaryGroup>
    </div>
  );
}
