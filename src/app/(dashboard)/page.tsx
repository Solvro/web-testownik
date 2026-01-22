import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { cookies } from "next/headers";

import { LoginPrompt } from "@/components/login-prompt";
import { API_URL } from "@/lib/api";
import { AUTH_COOKIES, GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { getContributorsSSR } from "@/lib/dashboard-ssr";
import { getQueryClient } from "@/lib/query-client";
import { QuizService } from "@/services/quiz.service";

import { AboutCard } from "./components/about-card";
import { ImportButtonsCard } from "./components/import-buttons-card";
import { LastUsedCard } from "./components/last-used-card";
import { QuestionQuizCard } from "./components/question-quiz-card";
import { SearchCard } from "./components/search-card";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const isGuest = cookieStore.get(GUEST_COOKIE_NAME)?.value === "true";

  const isAuthenticated =
    (accessToken !== undefined && accessToken !== "") || isGuest;

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  const queryClient = getQueryClient();

  if (!isGuest) {
    const quizService = new QuizService(API_URL, {}, accessToken);

    await Promise.all([
      queryClient.prefetchInfiniteQuery({
        queryKey: ["last-used-quizzes", isGuest, 10],
        queryFn: async () => quizService.getLastUsedQuizzes(10, 0),
        initialPageParam: 0,
      }),
      queryClient.prefetchQuery({
        queryKey: ["random-question", isGuest],
        queryFn: async () => quizService.getRandomQuestion(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["contributors"],
        queryFn: getContributorsSSR,
      }),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="grid gap-4 sm:grid-cols-2 sm:grid-rows-3 md:h-[70vh] md:grid-cols-3 md:grid-rows-2">
        <LastUsedCard className="md:order-2" isGuest={isGuest} />
        <ImportButtonsCard className="md:order-4" />
        <QuestionQuizCard className="row-span-2 md:order-1" isGuest={isGuest} />
        <SearchCard className="md:order-3" />
        <AboutCard className="md:order-5" />
      </div>
    </HydrationBoundary>
  );
}
