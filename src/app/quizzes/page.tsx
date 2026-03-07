import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth/constants";
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

  const userId =
    accessToken === undefined
      ? undefined
      : decodeAccessToken(accessToken)?.user_id;

  const queryClient = getQueryClient();

  if (accessToken !== undefined && accessToken !== "") {
    const quizService = new QuizService(API_URL, {}, accessToken);

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["user-quizzes"],
        queryFn: async () => quizService.getQuizzes(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["shared-quizzes"],
        queryFn: async () => quizService.getSharedQuizzes(),
      }),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QuizzesPageClient userId={userId} />
    </HydrationBoundary>
  );
}
