/**
 * Shapes returned by the public blog API, `GET /api/blog/posts/` (paginated
 * with `?limit=`/`?offset=`) and `GET /api/blog/posts/{slug}/`.
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

/** A single post, with its Markdown body. */
export interface BlogPost extends BlogPostSummary {
  /** Raw Markdown, rendered on the frontend. */
  content: string;
  /** ISO 8601. */
  created_at: string;
  /** ISO 8601. */
  updated_at: string;
}
