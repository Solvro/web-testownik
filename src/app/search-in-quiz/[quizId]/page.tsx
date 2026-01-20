import type { Metadata } from "next";

import { SearchInQuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Wyszukaj w quizie",
};

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default async function SearchInQuizPage({ params }: PageProps) {
  const { quizId } = await params;
  return <SearchInQuizPageClient quizId={quizId} />;
}
