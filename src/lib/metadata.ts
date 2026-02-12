import type { QuizMetadata } from "@/types/quiz";

import { API_URL } from "./api";

export async function getQuizMetadata(id: string): Promise<QuizMetadata> {
  const response = await fetch(`${API_URL}/quizzes/${id}/metadata`, {
    method: "GET",
    headers: {
      "Api-Key": process.env.INTERNAL_API_KEY ?? "",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch quiz metadata: ${response.statusText}`);
  }

  return (await response.json()) as QuizMetadata;
}
