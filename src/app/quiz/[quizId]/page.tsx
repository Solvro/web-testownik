import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { Loader } from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth/constants";
import { getQueryClient } from "@/lib/query-client";
import { ServiceRegistry } from "@/services";

import { QuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Quiz",
};

export default async function QuizPage({
  params,
}: PageProps<"/quiz/[quizId]">) {
  const { quizId } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  const queryClient = getQueryClient();

  const services = new ServiceRegistry(API_URL, {}, accessToken);

  const include = ["user_settings", "current_session"];

  await queryClient.prefetchQuery({
    queryKey: ["quiz", quizId, "details", { include }],
    queryFn: async () => {
      return await services.quiz.getQuiz(quizId, {
        include,
      });
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <Card>
            <CardContent>
              <div className="space-y-2 pb-8 text-center">
                <p>Ładowanie quizu...</p>
                <Loader size={15} />
              </div>
            </CardContent>
          </Card>
        }
      >
        <QuizPageClient quizId={quizId} />
      </Suspense>
    </HydrationBoundary>
  );
}
