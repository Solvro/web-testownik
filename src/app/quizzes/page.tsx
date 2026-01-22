import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_URL } from "@/lib/api";
import { AUTH_COOKIES, GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { decodeAccessToken } from "@/lib/auth/jwt-utils";
import { getQueryClient } from "@/lib/query-client";
import { QuizService } from "@/services/quiz.service";

import { QuizzesPageClient } from "./client";

export const metadata: Metadata = {
  title: "Twoje quizy",
};

export default async function QuizzesPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;
  const isGuest = cookieStore.get(GUEST_COOKIE_NAME)?.value === "true";

  const userId =
    accessToken === undefined
      ? undefined
      : decodeAccessToken(accessToken)?.user_id;

  const queryClient = getQueryClient();

  if (!isGuest) {
    const quizService = new QuizService(API_URL, {}, accessToken);

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["user-quizzes", isGuest],
        queryFn: async () => quizService.getQuizzes(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["shared-quizzes", isGuest],
        queryFn: async () => quizService.getSharedQuizzes(),
      }),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QuizzesPageClient userId={userId} isGuest={isGuest} />
    </HydrationBoundary>
  );
}
