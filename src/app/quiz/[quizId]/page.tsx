/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from "next";

import { QuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Quiz",
};

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default async function QuizPage({ params }: PageProps) {
  const { quizId } = await params;
  return <QuizPageClient quizId={quizId} />;
}
