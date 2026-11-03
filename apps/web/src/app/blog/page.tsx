import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false },
};

/** Placeholder until the blog is built; the landing update note links here. */
export default function BlogPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
      <p className="text-muted-foreground mt-4">Wkrótce.</p>
    </main>
  );
}
