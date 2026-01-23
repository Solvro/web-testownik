import "server-only";

import { GITHUB_REPOS, parseContributors } from "@/lib/contributors";
import type { GitHubContributor } from "@/lib/contributors";

/**
 * Get GitHub contributors (server-side with caching)
 */
export async function getContributorsSSR(): Promise<GitHubContributor[]> {
  try {
    const responses = await Promise.all(
      GITHUB_REPOS.map(async (repo) =>
        fetch(`https://api.github.com/repos/${repo}/contributors?anon=1`, {
          next: { revalidate: 3600 },
        }),
      ),
    );

    if (responses.some((response) => !response.ok)) {
      console.error("Failed to fetch contributors from GitHub");
      return [];
    }

    const data = await Promise.all(
      responses.map(
        async (response) => response.json() as Promise<GitHubContributor[]>,
      ),
    );

    return parseContributors(data);
  } catch (error) {
    console.error("Error fetching contributors:", error);
    return [];
  }
}
