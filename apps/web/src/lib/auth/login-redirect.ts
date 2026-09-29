/** Resolve a web-login return destination before client hydration. */
export function loginRedirect(
  destination: string | null,
  siteUrl: string,
): string {
  const fallback = new URL("/quizzes", siteUrl);
  try {
    const target = new URL(destination ?? "/quizzes", siteUrl);
    return target.origin === fallback.origin
      ? target.toString()
      : fallback.toString();
  } catch {
    return fallback.toString();
  }
}
