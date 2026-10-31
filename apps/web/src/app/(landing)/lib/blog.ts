import type { BlogPostSummary } from "@testownik/core/blog/types";
import type { ApiPaginatedResponse } from "@testownik/core/common";
import "server-only";

import { API_URL } from "@/lib/api";

/** A post as the update note lists it. */
export type LandingBlogPost = Pick<BlogPostSummary, "title" | "slug">;

/**
 * The latest published blog posts, for the update note. Never throws: on any
 * failure, or before anything is published, the note falls back to its
 * static changes.
 */
export async function getLatestBlogPostsSSR(
  limit = 3,
): Promise<LandingBlogPost[]> {
  try {
    const response = await fetch(
      `${API_URL}/blog/posts/?limit=${limit.toString()}`,
      {
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) {
      console.error("Failed to fetch blog posts for the landing page");
      return [];
    }
    const data =
      (await response.json()) as ApiPaginatedResponse<BlogPostSummary>;
    return data.results.map(({ title, slug }) => ({ title, slug }));
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}
