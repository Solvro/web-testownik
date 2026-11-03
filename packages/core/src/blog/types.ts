/**
 * Shapes returned by the public blog API, `GET /api/blog/posts/` (paginated
 * with `?limit=`/`?offset=`).
 */

/** A post in the list. */
export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  /** Short summary for list views; may be empty. */
  excerpt: string;
  /** ISO 8601. */
  published_at: string | null;
  author_name: string | null;
}
