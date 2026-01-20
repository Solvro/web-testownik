import { cookies } from "next/headers";
import "server-only";

import { API_URL } from "@/lib/api";
import type { QuestionWithQuizInfo } from "@/services/types";
import type { QuizMetadata } from "@/types/quiz";

/**
 * Server-side fetch with auth token from cookies
 */
async function serverFetch<T>(
  endpoint: string,
  parameters?: Record<string, string>,
): Promise<T | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (accessToken === undefined || accessToken === "") {
    return null;
  }

  const url = new URL(`${API_URL}${endpoint}`);
  if (parameters !== undefined) {
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`SSR fetch failed: ${endpoint}`, response.status);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`SSR fetch error: ${endpoint}`, error);
    return null;
  }
}

/**
 * Get last used quizzes (server-side)
 */
export async function getLastUsedQuizzesSSR(
  limit = 10,
): Promise<QuizMetadata[]> {
  const data = await serverFetch<QuizMetadata[]>("/last-used-quizzes/", {
    limit: String(limit),
  });
  return data ?? [];
}

/**
 * Get random question (server-side)
 */
export async function getRandomQuestionSSR(): Promise<QuestionWithQuizInfo | null> {
  return serverFetch<QuestionWithQuizInfo>("/random-question/");
}

/**
 * GitHub contributor type
 */
export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
  contributions: number;
}

/**
 * Get GitHub contributors (server-side with caching)
 */
export async function getContributorsSSR(): Promise<GitHubContributor[]> {
  try {
    const [coreResponse, frontendResponse] = await Promise.all([
      fetch(
        "https://api.github.com/repos/Solvro/backend-testownik/contributors?anon=1",
        { next: { revalidate: 3600 } },
      ),
      fetch(
        "https://api.github.com/repos/Solvro/web-testownik/contributors?anon=1",
        { next: { revalidate: 3600 } },
      ),
    ]);

    if (!coreResponse.ok || !frontendResponse.ok) {
      console.error("Failed to fetch contributors from GitHub");
      return [];
    }

    const coreData = (await coreResponse.json()) as GitHubContributor[];
    const frontendData = (await frontendResponse.json()) as GitHubContributor[];

    const merged = [...coreData, ...frontendData]
      .filter((contributor) => contributor.type === "User")
      .reduce((accumulator: GitHubContributor[], contributor) => {
        const existing = accumulator.find((x) => x.login === contributor.login);
        if (existing === undefined) {
          accumulator.push({ ...contributor });
        } else {
          existing.contributions += contributor.contributions;
        }
        return accumulator;
      }, []);

    return merged.toSorted((a, b) => b.contributions - a.contributions);
  } catch (error) {
    console.error("Error fetching contributors:", error);
    return [];
  }
}
