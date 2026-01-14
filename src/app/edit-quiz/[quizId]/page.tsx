/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from "next";

import { EditQuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Edytuj quiz",
};

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default async function EditQuizPage({ params }: PageProps) {
  const { quizId } = await params;
  return <EditQuizPageClient quizId={quizId} />;
}
