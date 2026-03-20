import { cookies } from "next/headers";
import "server-only";

import { AUTH_COOKIES } from "@/lib/auth";
import type { QuizMetadata } from "@/types/quiz";

import { API_URL } from "./api";

export async function getQuizMetadata(id: string): Promise<QuizMetadata> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  const response = await fetch(`${API_URL}/quizzes/${id}/metadata`, {
    method: "GET",
    headers: {
      "Api-Key": process.env.INTERNAL_API_KEY ?? "",
      ...(token == null ? {} : { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch quiz metadata: ${response.statusText}`, {
      cause: response.status,
    });
  }

  return (await response.json()) as QuizMetadata;
}
