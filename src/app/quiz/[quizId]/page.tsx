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
import { ServiceRegistry } from "@/services";

import { QuizPageClient } from "./client";

export async function generateMetadata({
  params,
}: PageProps<"/quiz/[quizId]">): Promise<Metadata | null> {
  const { quizId } = await params;

  try {
    const metadata = await getQuizMetadata(quizId);
    return {
      title: metadata.title,
      description: metadata.description,
      authors: [{ name: metadata.maintainer?.full_name ?? "" }],
      robots: { index: false, follow: true },
      openGraph: {
        title: `${metadata.title} - Testownik Solvro`,
        description: metadata.description,
        type: "website",
        locale: "pl_PL",
      },
    };
  } catch (error) {
    if (error instanceof Error && error.cause === 403) {
      // Don't log error if it's a 403, as it likely means the quiz is private and the user doesn't have access
    } else {
      console.error("Error fetching quiz metadata:", error);
    }
    return null;
  }
}

export default async function QuizPage({
  params,
}: PageProps<"/quiz/[quizId]">) {
  const { quizId } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  const queryClient = getQueryClient();

  const services = new ServiceRegistry(API_URL, {}, accessToken);

  await queryClient.prefetchQuery({
    queryKey: quizDetailQueryKey(quizId),
    queryFn: async () => {
      return await services.quiz.getQuizWithProgress(quizId);
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
