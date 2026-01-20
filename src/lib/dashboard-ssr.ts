import "server-only";

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
