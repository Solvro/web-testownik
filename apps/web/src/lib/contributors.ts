export const GITHUB_REPOS = [
  "Solvro/backend-testownik",
  "Solvro/web-testownik",
  "Solvro/emails-testownik",
] as const;

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
 * Parses and merges contributors from multiple repositories.
 * filters out non-User types, dedupes by login, sums contributions, and sorts by contributions descending.
 */
export function parseContributors(
  contributorsChunks: GitHubContributor[][],
): GitHubContributor[] {
  const merged = contributorsChunks
    .flat()
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
}
