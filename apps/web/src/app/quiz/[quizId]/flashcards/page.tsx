import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { Loader } from "@/components/loader";
import { quizDetailQueryKey } from "@/components/quiz/helpers/utils";
import { Card, CardContent } from "@/components/ui/card";
import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth/constants";
import { getQuizMetadata } from "@/lib/metadata";
import { getQueryClient } from "@/lib/query-client";
import { QuizService } from "@/services/quiz.service";

import { FlashcardsPageClient } from "./client";

export async function generateMetadata({
  params,
}: PageProps<"/quiz/[quizId]/flashcards">): Promise<Metadata | null> {
  const { quizId } = await params;

  try {
    const metadata = await getQuizMetadata(quizId);
    return {
      title: `Fiszki: ${metadata.title}`,
      description: metadata.description,
      robots: { index: false, follow: true },
    };
  } catch (error) {
    // A 403 means a private quiz; nothing to log.
    if (!(error instanceof Error && error.cause === 403)) {
      console.error("Error fetching quiz metadata:", error);
    }
    return null;
  }
}

export default async function FlashcardsPage({
  params,
}: PageProps<"/quiz/[quizId]/flashcards">) {
  const { quizId } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: quizDetailQueryKey(quizId),
    queryFn: async () =>
      new QuizService(API_URL, {}, accessToken).getQuizWithProgress(quizId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <Card>
            <CardContent>
              <div className="space-y-2 pb-8 text-center">
                <p>Ładowanie fiszek...</p>
                <Loader size={15} />
              </div>
            </CardContent>
          </Card>
        }
      >
        <FlashcardsPageClient quizId={quizId} />
      </Suspense>
    </HydrationBoundary>
  );
}
