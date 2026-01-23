import type { Metadata } from "next";

import { EditQuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Edytuj quiz",
};

export default async function EditQuizPage({
  params,
}: PageProps<"/edit-quiz/[quizId]">) {
  const { quizId } = await params;
  return <EditQuizPageClient quizId={quizId} />;
}
