import type { Metadata } from "next";

import { SearchInQuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Wyszukaj w quizie",
};

export default async function SearchInQuizPage({
  params,
}: PageProps<"/search-in-quiz/[quizId]">) {
  const { quizId } = await params;
  return <SearchInQuizPageClient quizId={quizId} />;
}
