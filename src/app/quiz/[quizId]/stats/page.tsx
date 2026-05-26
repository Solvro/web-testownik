import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { Loader } from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { quizStatsKeys } from "@/hooks/use-quiz-stats";
import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth/constants";
import { getQueryClient } from "@/lib/query-client";
import { QuizService } from "@/services/quiz.service";

import { StatsPageClient } from "./client";

export const metadata: Metadata = {
  title: "Statystyki quizu",
};

export default async function StatsPage({
  params,
}: PageProps<"/quiz/[quizId]/stats">) {
  const { quizId } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const queryClient = getQueryClient();
  const quiz = await new QuizService(API_URL, {}, accessToken).getQuizMetadata(
    quizId,
  );

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: quizStatsKeys.aggregated(quizId, "me"),
      queryFn: async () =>
        new QuizService(API_URL, {}, accessToken).getQuizStats(quizId, "me"),
    }),
    queryClient.prefetchQuery({
      queryKey: quizStatsKeys.timeline(quizId, "me", 30),
      queryFn: async () =>
        new QuizService(API_URL, {}, accessToken).getQuizTimeline(
          quizId,
          "me",
          30,
        ),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <Card>
            <CardContent>
              <div className="space-y-2 pb-8 text-center">
                <p>Ładowanie statystyk...</p>
                <Loader size={15} />
              </div>
            </CardContent>
          </Card>
        }
      >
        <StatsPageClient quizId={quizId} quiz={quiz} />
      </Suspense>
    </HydrationBoundary>
  );
}
